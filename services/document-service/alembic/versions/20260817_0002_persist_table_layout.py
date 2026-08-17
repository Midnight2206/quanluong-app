"""Persist imported table layout metadata.

Revision ID: 20260817_0002
Revises: 20260817_0001
Create Date: 2026-08-17
"""

from typing import Optional, Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260817_0002"
down_revision: Optional[str] = "20260817_0001"
branch_labels: Optional[Union[str, Sequence[str]]] = None
depends_on: Optional[Union[str, Sequence[str]]] = None


def upgrade() -> None:
    op.add_column(
        "template_table_config",
        sa.Column("header_height_pt", sa.Float(), server_default="22", nullable=False),
    )
    op.add_column(
        "template_table_config",
        sa.Column("carry_height_pt", sa.Float(), server_default="18", nullable=False),
    )
    op.add_column(
        "template_table_config",
        sa.Column("data_row_style", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("template_table_config", "data_row_style")
    op.drop_column("template_table_config", "carry_height_pt")
    op.drop_column("template_table_config", "header_height_pt")
