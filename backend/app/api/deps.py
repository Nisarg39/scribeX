"""FastAPI dependency providers for authentication and request context."""

from fastapi import Header
from app.core.config import settings


async def get_current_user_id(
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
    authorization: str | None = Header(default=None),
) -> str:
    """Resolve the active user ID for the current request.

    In Phase 1, defaults to settings.default_user_id ('default_user').
    In SaaS phases, decodes JWT / machine pairing tokens from Authorization header.
    """
    if x_user_id:
        return x_user_id

    # Future SaaS JWT decoding stub
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        if token.startswith("usr_"):
            return token

    return settings.default_user_id
