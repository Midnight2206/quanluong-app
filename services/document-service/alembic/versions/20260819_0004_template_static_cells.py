"""Persist imported static Excel cells for template_table_config."""

from alembic import op
import sqlalchemy as sa


revision = "20260819_0004"
down_revision = "20260817_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "template_table_config",
        sa.Column("static_cells", sa.JSON(), nullable=True),
    )
    op.add_column(
        "template_table_config",
        sa.Column(
            "static_block_height_pt",
            sa.Float(),
            nullable=False,
            server_default=sa.text("80"),
        ),
    )


def downgrade() -> None:
    op.drop_column("template_table_config", "static_block_height_pt")
    op.drop_column("template_table_config", "static_cells")
