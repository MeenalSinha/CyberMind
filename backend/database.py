from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, Text, func
from typing import Optional, List
import logging

logger = logging.getLogger(__name__)

# ── Import validated settings ─────────────────────────────────────────────────
from config import settings

DATABASE_URL = settings.database_url
_is_sqlite   = DATABASE_URL.startswith("sqlite")

engine = create_async_engine(
    DATABASE_URL,
    echo=settings.db_echo,
    connect_args={"check_same_thread": False} if _is_sqlite else {},
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id:              Mapped[int]           = mapped_column(Integer, primary_key=True, index=True)
    name:            Mapped[str]           = mapped_column(String(100), nullable=False)
    email:           Mapped[str]           = mapped_column(String(200), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str]           = mapped_column(String(200), nullable=False)
    score_deepfake:  Mapped[int]           = mapped_column(Integer, server_default="0", default=0)
    score_phish:     Mapped[int]           = mapped_column(Integer, server_default="0", default=0)
    score_social:    Mapped[int]           = mapped_column(Integer, server_default="0", default=0)
    score_total:     Mapped[int]           = mapped_column(Integer, server_default="0", default=0)
    badges:          Mapped[str]           = mapped_column(Text, server_default="[]", default="[]")
    created_at:      Mapped[Optional[object]] = mapped_column(DateTime(timezone=True), server_default=func.now())

    sessions:  Mapped[List["GameSession"]] = relationship("GameSession",  back_populates="user", cascade="all, delete-orphan")
    decisions: Mapped[List["DecisionLog"]] = relationship("DecisionLog",  back_populates="user", cascade="all, delete-orphan")


class GameSession(Base):
    __tablename__ = "game_sessions"
    id:         Mapped[int]               = mapped_column(Integer, primary_key=True, index=True)
    user_id:    Mapped[Optional[int]]     = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    module:     Mapped[str]               = mapped_column(String(50), nullable=False)
    score:      Mapped[int]               = mapped_column(Integer, server_default="0", default=0)
    correct:    Mapped[int]               = mapped_column(Integer, server_default="0", default=0)
    total:      Mapped[int]               = mapped_column(Integer, server_default="0", default=0)
    created_at: Mapped[Optional[object]]  = mapped_column(DateTime(timezone=True), server_default=func.now())
    user:       Mapped[Optional["User"]]  = relationship("User", back_populates="sessions")


class DecisionLog(Base):
    __tablename__ = "decision_logs"
    id:         Mapped[int]               = mapped_column(Integer, primary_key=True, index=True)
    user_id:    Mapped[Optional[int]]     = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    module:     Mapped[str]               = mapped_column(String(50), nullable=False)
    item_id:    Mapped[int]               = mapped_column(Integer, nullable=False)
    answer:     Mapped[str]               = mapped_column(String(100), nullable=False)
    correct:    Mapped[bool]              = mapped_column(Boolean, server_default="0", default=False)
    points:     Mapped[int]               = mapped_column(Integer, server_default="0", default=0)
    created_at: Mapped[Optional[object]]  = mapped_column(DateTime(timezone=True), server_default=func.now())
    user:       Mapped[Optional["User"]]  = relationship("User", back_populates="decisions")


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables ensured.")


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
