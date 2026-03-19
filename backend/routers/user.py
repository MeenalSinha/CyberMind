from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel, Field
from typing import Optional, List
import json

from database import get_db, User, GameSession, DecisionLog
from auth_utils import get_current_user_required, get_current_user_optional

router = APIRouter()

BADGE_THRESHOLDS = {
    "deepfake_spotter": ("deepfake", 50),
    "phish_proof":      ("phish",    50),
    "human_firewall":   ("social",   50),
    "cyber_guardian":   ("total",    200),
}


def _compute_badges(user: User) -> List[str]:
    scores = {
        "deepfake": user.score_deepfake,
        "phish":    user.score_phish,
        "social":   user.score_social,
        "total":    user.score_total,
    }
    return [bid for bid, (field, thresh) in BADGE_THRESHOLDS.items() if scores.get(field, 0) >= thresh]


def _safe_isoformat(dt) -> Optional[str]:
    """Return ISO string or None — never raises AttributeError."""
    return dt.isoformat() if dt is not None else None


class UpdateScoreRequest(BaseModel):
    module:     str = Field(..., pattern="^(deepfake|phish|social)$")
    points:     int = Field(..., ge=0, le=500)
    # Idempotency key — client sends a unique ID per answer; duplicate submissions ignored
    attempt_id: str = Field(..., min_length=4, max_length=64)


# leaderboard MUST be before /{user_id} to avoid route shadowing
@router.get("/leaderboard")
async def get_leaderboard(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).order_by(User.score_total.desc()).limit(10))
    users  = result.scalars().all()
    return {
        "leaderboard": [
            {"rank": i + 1, "name": u.name, "score": u.score_total,
             "badges": len(json.loads(u.badges or "[]"))}
            for i, u in enumerate(users)
        ]
    }


@router.get("/me")
async def get_me(
    token_data: dict         = Depends(get_current_user_required),
    db:         AsyncSession = Depends(get_db),
):
    user_id = int(token_data["sub"])
    result  = await db.execute(select(User).where(User.id == user_id))
    user    = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    badges       = _compute_badges(user)
    user.badges  = json.dumps(badges)
    await db.commit()

    return {
        "id": user.id, "name": user.name, "email": user.email,
        "scores": {
            "deepfake": user.score_deepfake,
            "phish":    user.score_phish,
            "social":   user.score_social,
            "total":    user.score_total,
        },
        "badges": badges,
    }


@router.post("/update-score")
async def update_score(
    req:        UpdateScoreRequest,
    token_data: dict         = Depends(get_current_user_required),
    db:         AsyncSession = Depends(get_db),
):
    user_id = int(token_data["sub"])

    # Idempotency: check if this attempt_id was already logged
    existing = await db.execute(
        select(DecisionLog).where(
            and_(
                DecisionLog.user_id == user_id,
                DecisionLog.answer  == f"attempt:{req.attempt_id}",
            )
        )
    )
    if existing.scalar_one_or_none():
        # Already processed — return current scores without modifying
        result = await db.execute(select(User).where(User.id == user_id))
        user   = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")
        return {
            "status": "duplicate",
            "scores": {
                "deepfake": user.score_deepfake, "phish": user.score_phish,
                "social":   user.score_social,   "total": user.score_total,
            },
            "badges": json.loads(user.badges or "[]"),
        }

    result = await db.execute(select(User).where(User.id == user_id))
    user   = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if req.module == "deepfake": user.score_deepfake += req.points
    elif req.module == "phish":  user.score_phish    += req.points
    elif req.module == "social": user.score_social   += req.points
    user.score_total += req.points

    badges      = _compute_badges(user)
    user.badges = json.dumps(badges)

    # Log the attempt_id as idempotency record
    idem_log = DecisionLog(
        user_id=user_id, module=req.module, item_id=0,
        answer=f"attempt:{req.attempt_id}", correct=True, points=req.points,
    )
    db.add(idem_log)
    await db.commit()

    return {
        "status": "updated",
        "scores": {
            "deepfake": user.score_deepfake, "phish": user.score_phish,
            "social":   user.score_social,   "total": user.score_total,
        },
        "badges": badges,
    }


@router.get("/progress")
async def get_progress(
    token_data: dict         = Depends(get_current_user_required),
    db:         AsyncSession = Depends(get_db),
):
    """Return per-module session history for Dashboard trend display."""
    user_id = int(token_data["sub"])
    result  = await db.execute(select(User).where(User.id == user_id))
    user    = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    sessions_result = await db.execute(
        select(GameSession)
        .where(GameSession.user_id == user_id)
        .order_by(GameSession.created_at.asc())
        .limit(50)
    )
    sessions = sessions_result.scalars().all()

    # Group by module
    by_module: dict = {"deepfake": [], "phish": [], "social": []}
    for s in sessions:
        if s.module in by_module:
            by_module[s.module].append({
                "score":      s.score,
                "correct":    s.correct,
                "total":      s.total,
                "pct":        round((s.score / max(s.total * 15, 1)) * 100) if s.total else 0,
                "created_at": _safe_isoformat(s.created_at),
            })

    return {
        "scores": {
            "deepfake": user.score_deepfake,
            "phish":    user.score_phish,
            "social":   user.score_social,
            "total":    user.score_total,
        },
        "badges":      json.loads(user.badges or "[]"),
        "sessions_by_module": by_module,
        "total_sessions": len(sessions),
    }


@router.get("/{user_id}/profile")
async def get_profile(
    user_id:    int,
    token_data: Optional[dict] = Depends(get_current_user_optional),
    db:         AsyncSession   = Depends(get_db),
):
    if token_data and int(token_data.get("sub", -1)) != user_id:
        raise HTTPException(status_code=403, detail="Cannot view another user's profile.")

    result = await db.execute(select(User).where(User.id == user_id))
    user   = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    sessions_result = await db.execute(
        select(GameSession)
        .where(GameSession.user_id == user_id)
        .order_by(GameSession.created_at.desc())
        .limit(10)
    )
    sessions = sessions_result.scalars().all()

    return {
        "user": {
            "id":         user.id,
            "name":       user.name,
            "email":      user.email,
            # FIX: _safe_isoformat never raises on None created_at
            "created_at": _safe_isoformat(user.created_at),
        },
        "scores": {
            "deepfake": user.score_deepfake, "phish": user.score_phish,
            "social":   user.score_social,   "total": user.score_total,
        },
        "badges": json.loads(user.badges or "[]"),
        "recent_sessions": [
            {
                "module":     s.module,
                "score":      s.score,
                "correct":    s.correct,
                "total":      s.total,
                "created_at": _safe_isoformat(s.created_at),
            }
            for s in sessions
        ],
    }
