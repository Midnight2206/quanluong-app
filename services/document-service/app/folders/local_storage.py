from __future__ import annotations

import os
import shutil
from pathlib import Path

DEFAULT_DOCUMENT_STORAGE_ROOT = "/data/document-storage"


def storage_root() -> Path:
    configured = (os.environ.get("DOCUMENT_STORAGE_ROOT") or "").strip()
    root = configured or DEFAULT_DOCUMENT_STORAGE_ROOT
    return Path(root).expanduser()


def folders_root() -> Path:
    return storage_root() / "folders"


def folder_dir(folder_id: int) -> Path:
    return folders_root() / str(folder_id)


def sanitize_file_name(file_name: str) -> str:
    cleaned = str(file_name or "").strip()
    if not cleaned:
        raise ValueError("Tên file PDF không hợp lệ")
    candidate = Path(cleaned)
    if candidate.name != cleaned or cleaned in {".", ".."}:
        raise ValueError("Tên file PDF không hợp lệ")
    return cleaned


def relative_pdf_path(folder_id: int, file_name: str) -> str:
    return f"folders/{folder_id}/{sanitize_file_name(file_name)}"


def absolute_pdf_path(relative_path: str) -> Path:
    return storage_root() / Path(relative_path)


def write_folder_pdf(folder_id: int, file_name: str, content: bytes) -> str:
    folder = folder_dir(folder_id)
    folder.mkdir(parents=True, exist_ok=True)
    clean_name = sanitize_file_name(file_name)
    file_path = folder / clean_name
    file_path.write_bytes(content)
    return relative_pdf_path(folder_id, clean_name)


def delete_folder_tree(folder_id: int) -> None:
    shutil.rmtree(folder_dir(folder_id), ignore_errors=True)
