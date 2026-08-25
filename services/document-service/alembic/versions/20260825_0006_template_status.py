"""Add templates.status draft|published|retired."""

from alembic import op
import sqlalchemy as sa

revision = "20260825_0006"
down_revision = "20260823_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "templates",
        sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
    )
    op.create_check_constraint(
        "templates_status_check",
        "templates",
        "status IN ('draft', 'published', 'retired')",
    )
    op.execute("UPDATE templates SET status = 'published'")


def downgrade() -> None:
    op.drop_constraint("templates_status_check", "templates", type_="check")
    op.drop_column("templates", "status")
