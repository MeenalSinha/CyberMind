"""
Tests for /api/auth/signup and /api/auth/login.
All tests run against an in-memory SQLite database.
"""
import pytest


# ── Signup ────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_signup_success(client):
    res = await client.post("/api/auth/signup", json={
        "name": "Arjun Singh",
        "email": "arjun@example.com",
        "password": "SecurePass1",
    })
    assert res.status_code == 201
    body = res.json()
    assert "token" in body
    assert body["user"]["email"] == "arjun@example.com"
    assert body["user"]["name"]  == "Arjun Singh"
    assert body["user"]["scores"]["total"] == 0
    assert body["user"]["badges"] == []


@pytest.mark.asyncio
async def test_signup_duplicate_email(client):
    payload = {"name": "User One", "email": "dup@example.com", "password": "Pass1234"}
    await client.post("/api/auth/signup", json=payload)
    res = await client.post("/api/auth/signup", json=payload)
    assert res.status_code == 400
    assert "already registered" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_signup_invalid_email(client):
    res = await client.post("/api/auth/signup", json={
        "name": "Bad Email", "email": "not-an-email", "password": "Pass1234"
    })
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_signup_password_too_short(client):
    res = await client.post("/api/auth/signup", json={
        "name": "Short Pass", "email": "short@example.com", "password": "abc1"
    })
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_signup_password_no_digit(client):
    res = await client.post("/api/auth/signup", json={
        "name": "No Digit", "email": "nodigit@example.com", "password": "OnlyLetters"
    })
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_signup_password_no_letter(client):
    res = await client.post("/api/auth/signup", json={
        "name": "No Letter", "email": "noletter@example.com", "password": "12345678"
    })
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_signup_name_too_short(client):
    res = await client.post("/api/auth/signup", json={
        "name": "A", "email": "short@example.com", "password": "Pass1234"
    })
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_signup_name_xss(client):
    res = await client.post("/api/auth/signup", json={
        "name": "<script>alert(1)</script>",
        "email": "xss@example.com",
        "password": "Pass1234",
    })
    assert res.status_code == 422


# ── Login ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_login_success(client):
    await client.post("/api/auth/signup", json={
        "name": "Login User", "email": "login@example.com", "password": "LoginPass1"
    })
    res = await client.post("/api/auth/login", json={
        "email": "login@example.com", "password": "LoginPass1"
    })
    assert res.status_code == 200
    body = res.json()
    assert "token" in body
    assert body["user"]["email"] == "login@example.com"


@pytest.mark.asyncio
async def test_login_wrong_password(client):
    await client.post("/api/auth/signup", json={
        "name": "Wrong Pass", "email": "wrong@example.com", "password": "Correct1"
    })
    res = await client.post("/api/auth/login", json={
        "email": "wrong@example.com", "password": "Incorrect2"
    })
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_login_nonexistent_user(client):
    res = await client.post("/api/auth/login", json={
        "email": "ghost@example.com", "password": "Pass1234"
    })
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_login_email_case_insensitive(client):
    await client.post("/api/auth/signup", json={
        "name": "Case Test", "email": "Case@Example.COM", "password": "CasePass1"
    })
    res = await client.post("/api/auth/login", json={
        "email": "case@example.com", "password": "CasePass1"
    })
    assert res.status_code == 200
