"""Security and cryptographic utilities for ScribeX authentication."""

import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Any
from app.core.config import settings

PBKDF2_ITERATIONS = 100_000


def hash_password(password: str) -> tuple[str, str]:
    """Hash a password using PBKDF2-HMAC-SHA256 with a secure random salt.
    
    Returns:
        tuple of (password_hash_hex, salt_hex)
    """
    salt = secrets.token_bytes(16)
    hashed = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PBKDF2_ITERATIONS,
    )
    return hashed.hex(), salt.hex()


def verify_password(password: str, stored_hash: str, salt_hex: str) -> bool:
    """Verify a password against stored PBKDF2-HMAC-SHA256 hash and salt."""
    try:
        salt = bytes.fromhex(salt_hex)
        candidate_hash = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            PBKDF2_ITERATIONS,
        )
        return hmac.compare_digest(candidate_hash.hex(), stored_hash)
    except Exception:
        return False


def _b64_url_encode(data: bytes) -> str:
    """Encode bytes to URL-safe base64 without padding."""
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64_url_decode(data_str: str) -> bytes:
    """Decode URL-safe base64 string with optional padding."""
    padding = 4 - (len(data_str) % 4)
    if padding != 4:
        data_str += "=" * padding
    return base64.urlsafe_b64decode(data_str.encode("utf-8"))


def create_access_token(user_id: str, email: str, expires_in_days: int = 30) -> str:
    """Generate a signed cryptographic session token with embedded expiration."""
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": user_id,
        "email": email,
        "iat": int(time.time()),
        "exp": int(time.time()) + (expires_in_days * 86400),
    }

    header_b64 = _b64_url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64_url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")

    signature = hmac.new(
        settings.secret_key.encode("utf-8"),
        signing_input,
        hashlib.sha256,
    ).digest()
    sig_b64 = _b64_url_encode(signature)

    return f"{header_b64}.{payload_b64}.{sig_b64}"


def decode_access_token(token: str) -> dict[str, Any] | None:
    """Decode and verify a signed cryptographic session token.
    
    Returns:
        Token payload dictionary if valid, None if invalid or expired.
    """
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None

        header_b64, payload_b64, sig_b64 = parts
        signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
        expected_sig = hmac.new(
            settings.secret_key.encode("utf-8"),
            signing_input,
            hashlib.sha256,
        ).digest()

        actual_sig = _b64_url_decode(sig_b64)
        if not hmac.compare_digest(expected_sig, actual_sig):
            return None

        payload = json.loads(_b64_url_decode(payload_b64).decode("utf-8"))

        # Verify expiration
        if "exp" in payload and int(payload["exp"]) < int(time.time()):
            return None

        return payload
    except Exception:
        return None
