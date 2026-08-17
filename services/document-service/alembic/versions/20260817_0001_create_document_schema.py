"""Create document service schema.

Revision ID: 20260817_0001
Revises:
Create Date: 2026-08-17
"""

from typing import Optional, Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260817_0001"
down_revision: Optional[str] = None
branch_labels: Optional[Union[str, Sequence[str]]] = None
depends_on: Optional[Union[str, Sequence[str]]] = None


def upgrade() -> None:
    op.create_table(
        "templates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("version", sa.String(length=50), nullable=False),
        sa.Column("file_path", sa.String(length=1024), nullable=True),
        sa.Column("page_size", sa.String(length=20), nullable=False),
        sa.Column("orientation", sa.String(length=20), nullable=False),
        sa.Column("margin_top", sa.Float(), nullable=False),
        sa.Column("margin_right", sa.Float(), nullable=False),
        sa.Column("margin_bottom", sa.Float(), nullable=False),
        sa.Column("margin_left", sa.Float(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "template_fields",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("template_id", sa.Integer(), nullable=False),
        sa.Column("field_name", sa.String(length=255), nullable=False),
        sa.Column("sheet_name", sa.String(length=255), nullable=False),
        sa.Column("cell_ref", sa.String(length=50), nullable=False),
        sa.Column("x", sa.Float(), nullable=True),
        sa.Column("y", sa.Float(), nullable=True),
        sa.Column("font", sa.JSON(), nullable=True),
        sa.Column("align", sa.JSON(), nullable=True),
        sa.Column("border", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(["template_id"], ["templates.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_template_fields_template_id"),
        "template_fields",
        ["template_id"],
        unique=False,
    )
    op.create_table(
        "template_table_config",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("template_id", sa.Integer(), nullable=False),
        sa.Column("header_row_range", sa.String(length=50), nullable=False),
        sa.Column("data_row_template", sa.String(length=50), nullable=False),
        sa.Column("column_defs", sa.JSON(), nullable=True),
        sa.Column("subtotal_row_style", sa.JSON(), nullable=True),
        sa.Column("signature_block_height", sa.Float(), nullable=False),
        sa.Column("row_height_min", sa.Float(), server_default="18", nullable=False),
        sa.Column("row_height_max", sa.Float(), server_default="28", nullable=False),
        sa.Column("min_rows_last_page", sa.Integer(), server_default="2", nullable=False),
        sa.Column(
            "stretch_strategy",
            sa.String(length=50),
            server_default="end_bias",
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["template_id"], ["templates.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("template_id"),
    )
    op.create_table(
        "documents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("template_id", sa.Integer(), nullable=False),
        sa.Column("data", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("pdf_path", sa.String(length=1024), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["template_id"], ["templates.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_documents_template_id"),
        "documents",
        ["template_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_documents_template_id"), table_name="documents")
    op.drop_table("documents")
    op.drop_table("template_table_config")
    op.drop_index(op.f("ix_template_fields_template_id"), table_name="template_fields")
    op.drop_table("template_fields")
    op.drop_table("templates")
