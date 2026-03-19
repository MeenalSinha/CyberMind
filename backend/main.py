import logging
import os

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from limiter import limiter

from sqlalchemy import text

from database import AsyncSessionLocal, init_db
from routers import auth, deepfake, phish, social, user

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

from config import settings

# ── CORS ──────────────────────────────────────────────────────────────────────
ALLOWED_ORIGINS = settings.allowed_origins_list
logger.info(f"CORS allowed origins: {ALLOWED_ORIGINS}")

# ── Rate limiter (single instance shared across all routers) ──────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting CyberMind API...")
    await init_db()
    logger.info("Database ready.")
    yield
    logger.info("Shutting down.")


app = FastAPI(
    title="CyberMind API",
    description="The Human Defense Simulator — Backend API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if not settings.is_production else None,
    redoc_url=None,
)

# ── Attach limiter ────────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

# ── Global exception handler — never leak stack traces ───────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Please try again."},
    )

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router,     prefix="/api/auth",     tags=["Authentication"])
app.include_router(deepfake.router, prefix="/api/deepfake", tags=["Deepfake Detective"])
app.include_router(phish.router,    prefix="/api/phish",    tags=["PhishBuster"])
app.include_router(social.router,   prefix="/api/social",   tags=["Social RPG"])
app.include_router(user.router,     prefix="/api/user",     tags=["User"])


@app.get("/")
async def root():
    return {"message": "CyberMind API v1.0", "status": "operational"}


# ── Deep health check — verifies DB is actually reachable ────────────────────
@app.get("/health")
async def health():
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception as e:
        logger.error(f"Health check DB failure: {e}")
        db_status = "unreachable"

    ok = db_status == "ok"
    return JSONResponse(
        status_code=200 if ok else 503,
        content={"status": "ok" if ok else "degraded", "db": db_status, "version": "1.0.0"},
    )
