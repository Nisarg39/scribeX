"""ScribeX SaaS Authentication Endpoints.

Provides registration, login, and active user session inspection with
automatic tenant workspace provisioning on the VPS.
"""

from typing import Any
import re
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.deps import get_current_user_id
from app.core.security import create_access_token
from app.storage.auth_db import create_user, authenticate_user, get_user_by_id
from app.storage.paths import ensure_tenant_directories
from app.storage.sqlite_db import init_db

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])

EMAIL_REGEX = re.compile(r"^[\w\.-]+@[\w\.-]+\.\w+$")


class RegisterRequest(BaseModel):
    """Payload for user registration."""

    name: str = Field(..., min_length=1, description="Full name of the user.")
    email: str = Field(..., description="Valid email address.")
    password: str = Field(..., min_length=6, description="Password with minimum 6 characters.")


class LoginRequest(BaseModel):
    """Payload for user login."""

    email: str = Field(..., description="Registered email address.")
    password: str = Field(..., description="Account password.")


class UserProfileResponse(BaseModel):
    """Public user profile."""

    id: str
    email: str
    name: str
    createdAt: str | None = None


class AuthSessionResponse(BaseModel):
    """Standardized authentication session response."""

    user: UserProfileResponse
    token: str


@router.post("/register", response_model=AuthSessionResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest) -> AuthSessionResponse:
    """Register a new user account and provision their isolated tenant workspace."""
    email = payload.email.strip().lower()
    if not EMAIL_REGEX.match(email):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Please provide a valid email address.",
        )

    try:
        user_record = await create_user(
            email=email,
            name=payload.name,
            password=payload.password,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )

    user_id = user_record["id"]

    # Auto-provision tenant directory structure and operational database
    ensure_tenant_directories(user_id)
    await init_db(user_id)

    token = create_access_token(user_id=user_id, email=email)

    return AuthSessionResponse(
        user=UserProfileResponse(
            id=user_id,
            email=email,
            name=user_record["name"],
            createdAt=user_record.get("created_at"),
        ),
        token=token,
    )


@router.post("/login", response_model=AuthSessionResponse)
async def login(payload: LoginRequest) -> AuthSessionResponse:
    """Authenticate an existing user and return an active session token."""
    email = payload.email.strip().lower()
    user_record = await authenticate_user(email=email, password=payload.password)

    if not user_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    user_id = user_record["id"]

    # Ensure tenant workspace exists (self-healing)
    ensure_tenant_directories(user_id)
    await init_db(user_id)

    token = create_access_token(user_id=user_id, email=email)

    return AuthSessionResponse(
        user=UserProfileResponse(
            id=user_id,
            email=email,
            name=user_record["name"],
            createdAt=str(user_record.get("created_at") or ""),
        ),
        token=token,
    )


@router.get("/me", response_model=UserProfileResponse)
async def get_current_user_profile(
    user_id: str = Depends(get_current_user_id),
) -> UserProfileResponse:
    """Return the currently authenticated user's profile."""
    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found.",
        )

    return UserProfileResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        createdAt=str(user.get("created_at") or ""),
    )
