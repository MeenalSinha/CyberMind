from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr, Field, field_validator
import json
import re

from database import get_db, User
from auth_utils import verify_password, get_password_hash, create_access_token

router = APIRouter()

_DUMMY_HASH = "$2b$12$zzzzzzzzzzzzzzzzzzzzzuTQAFCg/NnUhbMC3iO6QMiJBJEMGkUGO"


class SignupRequest(BaseModel):
    name:     str      = Field(..., min_length=2, max_length=100, strip_whitespace=True)
    email:    EmailStr
    password: str      = Field(..., min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def password_complexity(cls, v: str) -> str:
        """Require at least one letter and one digit."""
        if not re.search(r"[A-Za-z]", v):
            raise ValueError("Password must contain at least one letter.")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one number.")
        return v

    @field_validator("name")
    @classmethod
    def name_no_html(cls, v: str) -> str:
        if re.search(r"[<>\"']", v):
            raise ValueError("Name contains invalid characters.")
        return v


class LoginRequest(BaseModel):
    email:    EmailStr
    password: str = Field(..., min_length=1, max_length=128)


@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(request: Request, req: SignupRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email.lower()))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered.")

    user = User(
        name=req.name,
        email=req.email.lower(),
        hashed_password=get_password_hash(req.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token({"sub": str(user.id), "email": user.email})
    return {
        "token": token,
        "user": {
            "id":     user.id,
            "name":   user.name,
            "email":  user.email,
            "scores": {"deepfake": 0, "phish": 0, "social": 0, "total": 0},
            "badges": [],
        },
    }


@router.post("/login")
async def login(request: Request, req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email.lower()))
    user   = result.scalar_one_or_none()

    # Timing-safe: always hash even when user not found
    password_ok = verify_password(req.password, user.hashed_password if user else _DUMMY_HASH)
    if not user or not password_ok:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token = create_access_token({"sub": str(user.id), "email": user.email})
    return {
        "token": token,
        "user": {
            "id":     user.id,
            "name":   user.name,
            "email":  user.email,
            "scores": {
                "deepfake": user.score_deepfake,
                "phish":    user.score_phish,
                "social":   user.score_social,
                "total":    user.score_total,
            },
            "badges": json.loads(user.badges or "[]"),
        },
    }
