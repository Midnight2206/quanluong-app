from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Template(Base):
    __tablename__ = "templates"
    __table_args__ = (
        UniqueConstraint("name", "version", name="templates_name_version_key"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    version: Mapped[str] = mapped_column(String(50), nullable=False)
    file_path: Mapped[Optional[str]] = mapped_column(String(1024))
    page_size: Mapped[str] = mapped_column(String(20), nullable=False)
    orientation: Mapped[str] = mapped_column(String(20), nullable=False)
    margin_top: Mapped[float] = mapped_column(Float, nullable=False)
    margin_right: Mapped[float] = mapped_column(Float, nullable=False)
    margin_bottom: Mapped[float] = mapped_column(Float, nullable=False)
    margin_left: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class TemplateField(Base):
    __tablename__ = "template_fields"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    template_id: Mapped[int] = mapped_column(
        ForeignKey("templates.id", ondelete="CASCADE"), nullable=False, index=True
    )
    field_name: Mapped[str] = mapped_column(String(255), nullable=False)
    sheet_name: Mapped[str] = mapped_column(String(255), nullable=False)
    cell_ref: Mapped[str] = mapped_column(String(50), nullable=False)
    x: Mapped[Optional[float]] = mapped_column(Float)
    y: Mapped[Optional[float]] = mapped_column(Float)
    font: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON)
    align: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON)
    border: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON)


class TemplateTableConfig(Base):
    __tablename__ = "template_table_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    template_id: Mapped[int] = mapped_column(
        ForeignKey("templates.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    header_row_range: Mapped[str] = mapped_column(String(50), nullable=False)
    data_row_template: Mapped[str] = mapped_column(String(50), nullable=False)
    column_defs: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON)
    data_row_style: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON)
    subtotal_row_style: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON)
    header_height_pt: Mapped[float] = mapped_column(
        Float, nullable=False, default=22, server_default=text("22")
    )
    carry_height_pt: Mapped[float] = mapped_column(
        Float, nullable=False, default=18, server_default=text("18")
    )
    signature_block_height: Mapped[float] = mapped_column(Float, nullable=False)
    row_height_min: Mapped[float] = mapped_column(
        Float, nullable=False, default=18, server_default=text("18")
    )
    row_height_max: Mapped[float] = mapped_column(
        Float, nullable=False, default=28, server_default=text("28")
    )
    min_rows_last_page: Mapped[int] = mapped_column(
        Integer, nullable=False, default=2, server_default=text("2")
    )
    stretch_strategy: Mapped[str] = mapped_column(
        String(50), nullable=False, default="end_bias", server_default=text("'end_bias'")
    )


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    template_id: Mapped[int] = mapped_column(
        ForeignKey("templates.id", ondelete="CASCADE"), nullable=False, index=True
    )
    data: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    pdf_path: Mapped[Optional[str]] = mapped_column(String(1024))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
