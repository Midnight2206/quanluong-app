from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import Document, Template

from .demo_data import build_bien_ban_test_v2_demo


def _document_payload(document: Document) -> dict:
    data = document.data or {}
    return {
        "id": document.id,
        "template_id": document.template_id,
        "demo_key": data.get("demo_key"),
        "fields": data.get("fields") or {},
        "rows": data.get("rows") or [],
        "row_count": len(data.get("rows") or []),
        "created_at": document.created_at,
    }


def get_document(session: Session, document_id: int) -> Document | None:
    return session.get(Document, document_id)


def get_document_payload(session: Session, document_id: int) -> dict | None:
    document = get_document(session, document_id)
    if document is None:
        return None
    return _document_payload(document)


def save_document(
    session: Session,
    *,
    template_id: int,
    fields: dict,
    rows: list[dict],
    demo_key: str | None = None,
) -> int:
    data = {"fields": fields, "rows": rows}
    if demo_key:
        data["demo_key"] = demo_key
        session.execute(
            delete(Document).where(
                Document.template_id == template_id,
                Document.data["demo_key"].as_string() == demo_key,
            )
        )
    document = Document(template_id=template_id, data=data)
    session.add(document)
    session.flush()
    return document.id


def find_template(session: Session, *, name: str, version: str) -> Template | None:
    return session.scalar(
        select(Template).where(Template.name == name, Template.version == version)
    )


def seed_bien_ban_test_v2_demo(session: Session, *, row_count: int = 45) -> dict:
    template = find_template(session, name="bien_ban_test", version="2")
    if template is None:
        raise ValueError("Không tìm thấy mẫu bien_ban_test v2")
    payload = build_bien_ban_test_v2_demo(row_count=row_count)
    document_id = save_document(
        session,
        template_id=template.id,
        fields=payload["fields"],
        rows=payload["rows"],
        demo_key=payload["demo_key"],
    )
    document = get_document(session, document_id)
    assert document is not None
    return _document_payload(document)


def seed_demo_for_template(session: Session, *, template_id: int, row_count: int = 45) -> dict:
    template = session.get(Template, template_id)
    if template is None:
        raise ValueError(f"Không tìm thấy mẫu #{template_id}")
    payload = build_bien_ban_test_v2_demo(row_count=row_count)
    demo_key = f"demo_{template.name}_{template.version}"
    document_id = save_document(
        session,
        template_id=template_id,
        fields=payload["fields"],
        rows=payload["rows"],
        demo_key=demo_key,
    )
    document = get_document(session, document_id)
    assert document is not None
    return _document_payload(document)


__all__ = [
    "get_document",
    "get_document_payload",
    "save_document",
    "seed_bien_ban_test_v2_demo",
    "seed_demo_for_template",
]
