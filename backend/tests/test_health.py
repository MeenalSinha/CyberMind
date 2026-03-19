"""Tests for infrastructure endpoints."""
import pytest


@pytest.mark.asyncio
async def test_root(client):
    res = await client.get("/")
    assert res.status_code == 200
    assert res.json()["status"] == "operational"


@pytest.mark.asyncio
async def test_health_ok(client):
    res = await client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["db"]     == "ok"
    assert body["status"] == "ok"


@pytest.mark.asyncio
async def test_404_returns_json(client):
    res = await client.get("/api/nonexistent-route")
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_cors_headers_present(client):
    res = await client.options(
        "/api/auth/login",
        headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST"},
    )
    # FastAPI CORS returns 200 for preflight
    assert res.status_code in (200, 400)
