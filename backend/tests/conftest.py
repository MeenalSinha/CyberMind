"""Shared pytest fixtures for the CyberMind test suite."""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from slowapi import Limiter
from slowapi.util import get_remote_address

from database import Base, get_db
from main import app
import limiter as limiter_module

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

# A disabled limiter — same key_func, but enabled=False so no requests are ever blocked
_disabled_limiter = Limiter(key_func=get_remote_address, enabled=False)


@pytest_asyncio.fixture(scope="session")
async def db_engine():
    """Single engine for the whole test session."""
    engine = create_async_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def db_session(db_engine):
    """Fresh session per test."""
    session_factory = async_sessionmaker(db_engine, expire_on_commit=False, class_=AsyncSession)
    async with session_factory() as session:
        yield session


@pytest_asyncio.fixture(scope="function")
async def client(db_session):
    """HTTP test client with DB override and rate-limiting disabled."""
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    # Swap the limiter for a disabled one so no test gets 429
    original_limiter = limiter_module.limiter
    limiter_module.limiter = _disabled_limiter
    app.state.limiter = _disabled_limiter

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac

    # Restore
    limiter_module.limiter = original_limiter
    app.state.limiter = original_limiter
    app.dependency_overrides.clear()
