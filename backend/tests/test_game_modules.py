"""
Tests for Deepfake, PhishBuster, and Social RPG game endpoints.
"""
import pytest


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _signup_and_token(client, email="game@example.com", password="GamePass1"):
    res = await client.post("/api/auth/signup", json={
        "name": "Game User", "email": email, "password": password
    })
    assert res.status_code == 201
    return res.json()["token"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ── Deepfake Detective ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_deepfake_samples_returns_list(client):
    res = await client.get("/api/deepfake/samples")
    assert res.status_code == 200
    body = res.json()
    assert "samples" in body
    assert len(body["samples"]) >= 7
    # Each sample must have required fields
    for s in body["samples"]:
        assert "id" in s
        assert "label" in s
        assert s["label"] in ("Real", "AI-Generated")
        assert "clues" in s
        assert "explanation" in s


@pytest.mark.asyncio
async def test_deepfake_submit_correct_answer(client):
    token = await _signup_and_token(client, "df@example.com")
    res = await client.post(
        "/api/deepfake/submit",
        json={"sample_id": 1, "answer": "AI-Generated", "correct": True, "points": 15},
        headers=auth_headers(token),
    )
    assert res.status_code == 200
    assert res.json()["correct"] is True
    assert res.json()["points"] == 15


@pytest.mark.asyncio
async def test_deepfake_submit_wrong_answer(client):
    token = await _signup_and_token(client, "df2@example.com")
    res = await client.post(
        "/api/deepfake/submit",
        json={"sample_id": 1, "answer": "Real", "correct": False, "points": 0},
        headers=auth_headers(token),
    )
    assert res.status_code == 200
    assert res.json()["correct"] is False
    assert res.json()["points"] == 0


@pytest.mark.asyncio
async def test_deepfake_submit_invalid_answer(client):
    token = await _signup_and_token(client, "df3@example.com")
    res = await client.post(
        "/api/deepfake/submit",
        json={"sample_id": 1, "answer": "INVALID", "correct": True, "points": 15},
        headers=auth_headers(token),
    )
    assert res.status_code == 422  # Pydantic pattern validation


@pytest.mark.asyncio
async def test_deepfake_submit_points_ceiling(client):
    """Points above 50 must be rejected."""
    token = await _signup_and_token(client, "df4@example.com")
    res = await client.post(
        "/api/deepfake/submit",
        json={"sample_id": 1, "answer": "Real", "correct": True, "points": 9999},
        headers=auth_headers(token),
    )
    assert res.status_code == 422


# ── PhishBuster ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_phish_messages_returns_list(client):
    res = await client.get("/api/phish/messages")
    assert res.status_code == 200
    body = res.json()
    assert "messages" in body
    assert len(body["messages"]) >= 8
    for m in body["messages"]:
        assert "id"         in m
        assert "label"      in m
        assert "sender"     in m
        assert "body"       in m
        assert "redFlags"   in m
        assert "explanation" in m
        assert m["label"] in ("Safe", "Phishing", "Smishing")


@pytest.mark.asyncio
async def test_phish_submit_correct(client):
    token = await _signup_and_token(client, "phish@example.com")
    res = await client.post(
        "/api/phish/submit",
        json={"message_id": 1, "answer": "Phishing", "correct": True, "points": 15},
        headers=auth_headers(token),
    )
    assert res.status_code == 200
    assert res.json()["correct"] is True


@pytest.mark.asyncio
async def test_phish_submit_invalid_classification(client):
    token = await _signup_and_token(client, "phish2@example.com")
    res = await client.post(
        "/api/phish/submit",
        json={"message_id": 1, "answer": "Malware", "correct": False, "points": 0},
        headers=auth_headers(token),
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_phish_generate_valid_categories(client):
    for category in ["kyc", "upi", "prize"]:
        res = await client.get(f"/api/phish/generate?category={category}")
        assert res.status_code == 200
        body = res.json()
        assert "body" in body
        assert "subject" in body
        assert body["label"] == "Phishing"


@pytest.mark.asyncio
async def test_phish_generate_invalid_category(client):
    res = await client.get("/api/phish/generate?category=injection_attack")
    assert res.status_code == 422


# ── Social RPG ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_social_scenarios_list(client):
    res = await client.get("/api/social/scenarios")
    assert res.status_code == 200
    body = res.json()
    assert "scenarios" in body
    assert len(body["scenarios"]) >= 1
    scenario = body["scenarios"][0]
    assert "id"          in scenario
    assert "title"       in scenario
    assert "description" in scenario
    assert "maxScore"    in scenario


@pytest.mark.asyncio
async def test_social_get_full_scenario(client):
    res = await client.get("/api/social/scenarios/fake_it_support")
    assert res.status_code == 200
    body = res.json()
    assert "steps" in body
    assert len(body["steps"]) == 4
    for step in body["steps"]:
        assert "id"      in step
        assert "message" in step
        assert "choices" in step
        assert len(step["choices"]) == 3
        for choice in step["choices"]:
            assert "id"          in choice
            assert "text"        in choice
            assert "score"       in choice
            assert "label"       in choice
            assert "consequence" in choice


@pytest.mark.asyncio
async def test_social_get_nonexistent_scenario(client):
    res = await client.get("/api/social/scenarios/does_not_exist")
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_social_submit_decision(client):
    token = await _signup_and_token(client, "social@example.com")
    res = await client.post(
        "/api/social/submit-decision",
        json={"scenario_id": "fake_it_support", "step_id": 1, "choice_id": "c", "score": 35},
        headers=auth_headers(token),
    )
    assert res.status_code == 200
    assert res.json()["status"] == "logged"


@pytest.mark.asyncio
async def test_social_save_session(client):
    token = await _signup_and_token(client, "social2@example.com")
    res = await client.post(
        "/api/social/save-session",
        json={
            "scenario_id": "fake_it_support",
            "total_score": 90,
            "max_score":   100,
            "choices": [
                {"score": 35, "label": "secure"},
                {"score": 20, "label": "cautious"},
                {"score": 35, "label": "secure"},
            ],
        },
        headers=auth_headers(token),
    )
    assert res.status_code == 200
    assert res.json()["score"] == 90
    assert res.json()["pct"]   == 90


@pytest.mark.asyncio
async def test_social_save_session_zero_max_score_rejected(client):
    """max_score=0 must be rejected (would cause division by zero)."""
    token = await _signup_and_token(client, "social3@example.com")
    res = await client.post(
        "/api/social/save-session",
        json={
            "scenario_id": "fake_it_support",
            "total_score": 0,
            "max_score":   0,
            "choices": [],
        },
        headers=auth_headers(token),
    )
    assert res.status_code == 422
