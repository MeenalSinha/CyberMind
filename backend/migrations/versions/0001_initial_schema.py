"""Initial schema — users, game_sessions, decision_logs.

Revision ID: 0001
Revises: 
Create Date: 2024-01-01 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id",              sa.Integer(),    primary_key=True),
        sa.Column("name",            sa.String(100),  nullable=False),
        sa.Column("email",           sa.String(200),  nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(200),  nullable=False),
        sa.Column("score_deepfake",  sa.Integer(),    server_default="0"),
        sa.Column("score_phish",     sa.Integer(),    server_default="0"),
        sa.Column("score_social",    sa.Integer(),    server_default="0"),
        sa.Column("score_total",     sa.Integer(),    server_default="0"),
        sa.Column("badges",          sa.Text(),       server_default="[]"),
        sa.Column("created_at",      sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "game_sessions",
        sa.Column("id",         sa.Integer(), primary_key=True),
        sa.Column("user_id",    sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("module",     sa.String(50), nullable=False),
        sa.Column("score",      sa.Integer(), server_default="0"),
        sa.Column("correct",    sa.Integer(), server_default="0"),
        sa.Column("total",      sa.Integer(), server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_game_sessions_user_id", "game_sessions", ["user_id"])

    op.create_table(
        "decision_logs",
        sa.Column("id",         sa.Integer(), primary_key=True),
        sa.Column("user_id",    sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("module",     sa.String(50),  nullable=False),
        sa.Column("item_id",    sa.Integer(),   nullable=False),
        sa.Column("answer",     sa.String(100), nullable=False),
        sa.Column("correct",    sa.Boolean(),   server_default="0"),
        sa.Column("points",     sa.Integer(),   server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_decision_logs_user_id", "decision_logs", ["user_id"])


def downgrade() -> None:
    op.drop_table("decision_logs")
    op.drop_table("game_sessions")
    op.drop_table("users")
