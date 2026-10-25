"""Tests for SaaS Authentication, Password Hashing, JWT Tokens, and Tenant Provisioning."""

import uuid
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.security import hash_password, verify_password, create_access_token, decode_access_token
from app.storage.paths import get_tenant_dir


def test_password_hashing_and_verification():
    """Verify cryptographic PBKDF2-HMAC-SHA256 password hashing and salt verification."""
    password = "SuperSecretPassword123!"
    hashed, salt = hash_password(password)
    assert hashed != password
    assert len(salt) > 0
    assert verify_password(password, hashed, salt) is True
    assert verify_password("WrongPassword!", hashed, salt) is False


def test_jwt_token_creation_and_decoding():
    """Verify HMAC-SHA256 signed JWT session token encoding and decoding."""
    user_id = f"usr_{uuid.uuid4().hex[:12]}"
    token = create_access_token(user_id=user_id, email="test@example.com")
    assert isinstance(token, str)

    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == user_id
    assert payload["email"] == "test@example.com"
    assert "exp" in payload


@pytest.mark.asyncio
async def test_auth_registration_and_login_lifecycle():
    """Verify complete registration, login, and profile inspection lifecycle."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        unique_id = uuid.uuid4().hex[:8]
        email = f"auth_test_{unique_id}@example.com"
        password = "ValidPassword123!"
        name = "ScribeX Tester"

        # 1. Register new user
        reg_resp = await client.post(
            "/api/v1/auth/register",
            json={"name": name, "email": email, "password": password},
        )
        assert reg_resp.status_code == 201
        reg_data = reg_resp.json()
        assert "token" in reg_data
        assert "user" in reg_data
        user_id = reg_data["user"]["id"]
        assert user_id.startswith("usr_")
        assert reg_data["user"]["email"] == email
        assert reg_data["user"]["name"] == name

        # 2. Verify duplicate registration fails with 409
        dup_resp = await client.post(
            "/api/v1/auth/register",
            json={"name": name, "email": email, "password": password},
        )
        assert dup_resp.status_code == 409
        assert "already exists" in dup_resp.json()["detail"]

        # 3. Verify tenant filesystem provisioning
        tenant_dir = get_tenant_dir(user_id)
        assert (tenant_dir / "vault").exists()
        assert (tenant_dir / "sqlite" / "scribex.db").exists()
        assert (tenant_dir / "lancedb").exists()

        # 4. Login with valid credentials
        login_resp = await client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": password},
        )
        assert login_resp.status_code == 200
        login_data = login_resp.json()
        token = login_data["token"]
        assert login_data["user"]["id"] == user_id

        # 5. Login with invalid password fails with 401
        bad_pwd_resp = await client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "WrongPassword!"},
        )
        assert bad_pwd_resp.status_code == 401

        # 6. Verify authenticated /me endpoint
        me_resp = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert me_resp.status_code == 200
        me_data = me_resp.json()
        assert me_data["id"] == user_id
        assert me_data["email"] == email
