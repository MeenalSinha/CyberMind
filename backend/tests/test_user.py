"""
Tests for /api/user/* endpoints — scoring, idempotency, leaderboard, profile.
"""
import pytest


async def _create_user(client, email, name="Test User", password="TestPass1"):
    res = await client.post("/api/auth/signup", json={
        "name": name, "email": email, "password": password
    })
    assert res.status_code == 201
    return res.json()["token"], res.json()["user"]["id"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}


# ── /me ───────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_me_authenticated(client):
    token, _ = await _create_user(client, "me@example.com")
    res = await client.get("/api/user/me", headers=auth(token))
    assert res.status_code == 200
    body = res.json()
    assert body["email"] == "me@example.com"
    assert "scores" in body
    assert "badges" in body


@pytest.mark.asyncio
async def test_get_me_unauthenticated(client):
    res = await client.get("/api/user/me")
    assert res.status_code == 401


# ── update-score ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_score_requires_auth(client):
    res = await client.post("/api/user/update-score", json={
        "module": "deepfake", "points": 15, "attempt_id": "abc123"
    })
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_update_score_deepfake(client):
    token, _ = await _create_user(client, "score@example.com")
    res = await client.post("/api/user/update-score", json={
        "module": "deepfake", "points": 15, "attempt_id": "attempt-001"
    }, headers=auth(token))
    assert res.status_code == 200
    body = res.json()
    assert body["scores"]["deepfake"] == 15
    assert body["scores"]["total"]    == 15


@pytest.mark.asyncio
async def test_update_score_idempotency(client):
    """Sending the same attempt_id twice must not double-credit."""
    token, _ = await _create_user(client, "idem@example.com")
    payload = {"module": "phish", "points": 15, "attempt_id": "idem-xyz"}

    res1 = await client.post("/api/user/update-score", json=payload, headers=auth(token))
    assert res1.status_code == 200
    assert res1.json()["scores"]["phish"] == 15

    res2 = await client.post("/api/user/update-score", json=payload, headers=auth(token))
    assert res2.status_code == 200
    # Second call returns "duplicate" status — score unchanged
    assert res2.json()["status"] == "duplicate"
    assert res2.json()["scores"]["phish"] == 15


@pytest.mark.asyncio
async def test_update_score_invalid_module(client):
    token, _ = await _create_user(client, "badmod@example.com")
    res = await client.post("/api/user/update-score", json={
        "module": "hacking", "points": 15, "attempt_id": "x"
    }, headers=auth(token))
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_update_score_points_ceiling(client):
    token, _ = await _create_user(client, "ceil@example.com")
    res = await client.post("/api/user/update-score", json={
        "module": "deepfake", "points": 9999, "attempt_id": "ceiling-test"
    }, headers=auth(token))
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_badges_awarded_at_threshold(client):
    token, _ = await _create_user(client, "badge@example.com")
    # Add 50 deepfake points in one call (at or above threshold = badge awarded)
    res = await client.post("/api/user/update-score", json={
        "module": "deepfake", "points": 50, "attempt_id": "badge-attempt"
    }, headers=auth(token))
    assert res.status_code == 200
    assert "deepfake_spotter" in res.json()["badges"]


# ── leaderboard ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_leaderboard_public(client):
    """Leaderboard must be accessible without auth."""
    res = await client.get("/api/user/leaderboard")
    assert res.status_code == 200
    assert "leaderboard" in res.json()


@pytest.mark.asyncio
async def test_leaderboard_ordering(client):
    t1, _ = await _create_user(client, "lb1@example.com", "Alpha")
    t2, _ = await _create_user(client, "lb2@example.com", "Beta")

    # Give Alpha 30 pts, Beta 60 pts
    await client.post("/api/user/update-score",
        json={"module": "phish", "points": 30, "attempt_id": "lb-a"},
        headers=auth(t1))
    await client.post("/api/user/update-score",
        json={"module": "phish", "points": 60, "attempt_id": "lb-b"},
        headers=auth(t2))

    res = await client.get("/api/user/leaderboard")
    board = res.json()["leaderboard"]
    scores = [e["score"] for e in board]
    assert scores == sorted(scores, reverse=True), "Leaderboard must be sorted descending"


# ── profile ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_profile_own(client):
    token, user_id = await _create_user(client, "prof@example.com")
    res = await client.get(f"/api/user/{user_id}/profile", headers=auth(token))
    assert res.status_code == 200
    body = res.json()
    assert body["user"]["id"]    == user_id
    assert body["user"]["email"] == "prof@example.com"
    assert "recent_sessions" in body


@pytest.mark.asyncio
async def test_profile_other_user_forbidden(client):
    t1, id1 = await _create_user(client, "own@example.com")
    t2, id2 = await _create_user(client, "other@example.com")
    # t1 tries to view t2's profile
    res = await client.get(f"/api/user/{id2}/profile", headers=auth(t1))
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_profile_not_found(client):
    token, _ = await _create_user(client, "find@example.com")
    res = await client.get("/api/user/99999/profile", headers=auth(token))
    assert res.status_code in (403, 404)  # 403 because sub != 99999
