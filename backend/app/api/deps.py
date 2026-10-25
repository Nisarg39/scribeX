"""FastAPI dependency providers for authentication and request context."""

from fastapi import Header
from app.core.config import settings
from app.core.security import decode_access_token


async def get_current_user_id(
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
    authorization: str | None = Header(default=None),
) -> str:
    """Resolve the active user ID for the current request.

    1. Checks Authorization header for valid signed JWT bearer token.
    2. Checks X-User-ID header if provided.
    3. Falls back to default_user_id.
    """
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1].strip()
        decoded = decode_access_token(token)
        if decoded and "sub" in decoded:
            return decoded["sub"]
        
        # Support development token prefixes
        if token.startswith("usr_"):
            return token

    if x_user_id:
        return x_user_id

    return settings.default_user_id

