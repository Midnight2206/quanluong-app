"""Unique template name and version.

Revision ID: 20260817_0003
Revises: 20260817_0002
Create Date: 2026-08-17
"""

from typing import Optional, Sequence, Union

from alembic import op

revision: str = "20260817_0003"
down_revision: Optional[str] = "20260817_0002"
branch_labels: Optional[Union[str, Sequence[str]]] = None
depends_on: Optional[Union[str, Sequence[str]]] = None


def upgrade() -> None:
    op.create_unique_constraint(
        "templates_name_version_key",
        "templates",
        ["name", "version"],
    )


def downgrade() -> None:
    op.drop_constraint("templates_name_version_key", "templates", type_="unique")
