"""Add folders and folder_files tables."""

from alembic import op
import sqlalchemy as sa


revision = "20260823_0005"
down_revision = "20260819_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "folders",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "folder_files",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("folder_id", sa.Integer(), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("pdf_path", sa.String(length=1024), nullable=False),
        sa.Column("sort_key", sa.String(length=255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["folder_id"], ["folders.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "folder_id",
            "file_name",
            name="folder_files_folder_id_file_name_key",
        ),
    )
    op.create_index(
        op.f("ix_folder_files_folder_id"),
        "folder_files",
        ["folder_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_folder_files_folder_id"), table_name="folder_files")
    op.drop_table("folder_files")
    op.drop_table("folders")
