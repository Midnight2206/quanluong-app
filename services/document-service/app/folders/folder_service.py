from __future__ import annotations

from importlib import import_module
from io import BytesIO
from pathlib import Path
import zipfile

from pypdf import PdfWriter
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Folder, FolderFile, Template
from app.render.pdf_renderer import render_pdf
from app.render.signature_block import parse_signature_block_config
from app.templates.status import STATUS_PUBLISHED

from .local_storage import (
    absolute_pdf_path,
    delete_folder_tree,
    sanitize_file_name,
    write_folder_pdf,
)

load_metadata_from_db = import_module("app.import.metadata_store").load_metadata_from_db


class FolderNotFoundError(LookupError):
    pass


class FolderFileNotFoundError(LookupError):
    pass


class TemplateMetadataNotFoundError(LookupError):
    pass


class TemplateNotPublishedError(ValueError):
    pass


def _file_sort_key(file: FolderFile) -> tuple[bool, str, int]:
    return (file.sort_key is None, str(file.sort_key or ""), file.id)


def _folder_file_item(file: FolderFile) -> dict:
    return {
        "id": file.id,
        "file_name": file.file_name,
        "sort_key": file.sort_key,
        "created_at": file.created_at,
    }


def _folder_item(folder: Folder, files: list[FolderFile]) -> dict:
    ordered_files = sorted(files, key=_file_sort_key)
    return {
        "id": folder.id,
        "name": folder.name,
        "created_at": folder.created_at,
        "files": [_folder_file_item(file) for file in ordered_files],
    }


def _require_folder(session: Session, folder_id: int) -> Folder:
    folder = session.get(Folder, folder_id)
    if folder is None:
        raise FolderNotFoundError("Không tìm thấy folder")
    return folder


def require_published_template(session: Session, template_id: int) -> Template | None:
    template = session.get(Template, template_id)
    if template is None:
        return None
    if template.status != STATUS_PUBLISHED:
        raise TemplateNotPublishedError("Chỉ mẫu đã publish mới được render PDF")
    return template


def _folder_files(session: Session, folder_id: int) -> list[FolderFile]:
    files = session.scalars(
        select(FolderFile).where(FolderFile.folder_id == folder_id)
    ).all()
    return sorted(files, key=_file_sort_key)


def _require_folder_file(session: Session, folder_id: int, file_id: int) -> FolderFile:
    file = session.get(FolderFile, file_id)
    if file is None or file.folder_id != folder_id:
        raise FolderFileNotFoundError("Không tìm thấy file PDF")
    return file


def _absolute_pdf_path(file: FolderFile) -> Path:
    path = absolute_pdf_path(file.pdf_path)
    if not path.is_file():
        raise FolderFileNotFoundError("Không tìm thấy file PDF")
    return path


def create_folder(session: Session, name: str) -> int:
    folder_name = str(name or "").strip()
    if not folder_name:
        raise ValueError("Tên folder không hợp lệ")
    folder = Folder(name=folder_name)
    session.add(folder)
    session.flush()
    return folder.id


def get_folder(session: Session, folder_id: int) -> dict:
    folder = _require_folder(session, folder_id)
    return _folder_item(folder, _folder_files(session, folder_id))


def add_folder_document(
    session: Session,
    folder_id: int,
    template_id: int,
    payload: dict,
    file_name: str,
    sort_key: str | None = None,
) -> dict:
    _require_folder(session, folder_id)
    require_published_template(session, template_id)
    clean_file_name = sanitize_file_name(file_name)
    clean_sort_key = str(sort_key).strip() or None if sort_key is not None else None
    if session.scalar(
        select(FolderFile).where(
            FolderFile.folder_id == folder_id,
            FolderFile.file_name == clean_file_name,
        )
    ):
        raise ValueError("Tên file đã tồn tại trong folder")
    metadata = load_metadata_from_db(session, template_id)
    if metadata is None:
        raise TemplateMetadataNotFoundError("Không tìm thấy mẫu")

    signature_block = payload.get("signature_block")
    if signature_block is not None:
        metadata.signature_block = parse_signature_block_config(signature_block)

    pdf_bytes = render_pdf(
        metadata=metadata,
        fields=payload.get("fields") or {},
        rows=payload.get("rows") or [],
        signatures=payload.get("signatures") or {},
        signature_dates=payload.get("signature_dates") or {},
    )
    pdf_path = write_folder_pdf(folder_id, clean_file_name, pdf_bytes)
    folder_file = FolderFile(
        folder_id=folder_id,
        file_name=clean_file_name,
        pdf_path=pdf_path,
        sort_key=clean_sort_key,
    )
    session.add(folder_file)
    session.flush()
    return {"file_id": folder_file.id, "file_name": folder_file.file_name}


def get_folder_file(session: Session, folder_id: int, file_id: int) -> dict:
    _require_folder(session, folder_id)
    file = _require_folder_file(session, folder_id, file_id)
    return {
        "id": file.id,
        "file_name": file.file_name,
        "pdf_path": str(_absolute_pdf_path(file)),
        "created_at": file.created_at,
    }


def build_zip(session: Session, folder_id: int) -> bytes:
    _require_folder(session, folder_id)
    files = _folder_files(session, folder_id)
    output = BytesIO()
    with zipfile.ZipFile(output, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
        for file in files:
            archive.write(_absolute_pdf_path(file), arcname=file.file_name)
    return output.getvalue()


def build_merged_pdf(session: Session, folder_id: int) -> bytes:
    _require_folder(session, folder_id)
    files = _folder_files(session, folder_id)
    writer = PdfWriter()
    for file in files:
        writer.append(str(_absolute_pdf_path(file)))
    output = BytesIO()
    writer.write(output)
    return output.getvalue()


def delete_folder(session: Session, folder_id: int) -> None:
    folder = _require_folder(session, folder_id)
    session.delete(folder)
    session.flush()
    delete_folder_tree(folder_id)


__all__ = [
    "FolderFileNotFoundError",
    "FolderNotFoundError",
    "TemplateMetadataNotFoundError",
    "TemplateNotPublishedError",
    "add_folder_document",
    "build_merged_pdf",
    "build_zip",
    "create_folder",
    "delete_folder",
    "get_folder",
    "get_folder_file",
    "require_published_template",
]
