"""ScribeX Core VPS Backend Application Entry Point."""

from contextlib import asynccontextmanager
from typing import AsyncGenerator
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.storage.paths import ensure_tenant_directories

logging.basicConfig(level=settings.log_level)
logger = logging.getLogger("scribex.main")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager for startup and shutdown events."""
    logger.info("Initializing ScribeX Core Backend...")

    # Ensure baseline storage directories exist for default user
    paths = ensure_tenant_directories(settings.default_user_id)
    logger.info(f"Initialized storage paths for default user at: {paths['base_root']}")

    # Initialize SQLite database schema
    from app.storage.sqlite_db import init_db
    await init_db(settings.default_user_id)
    logger.info("Operational SQLite database initialized in WAL mode.")

    yield

    logger.info("Shutting down ScribeX Core Backend...")


app = FastAPI(
    title="ScribeX Core VPS",
    description="Friday-inspired universal note-taking & agentic personal assistant backend",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["System"])
async def health_check() -> dict[str, str]:
    """Health check endpoint to verify server is active and healthy."""
    return {
        "status": "healthy",
        "service": "ScribeX Core VPS",
        "environment": settings.environment,
        "default_user": settings.default_user_id,
    }


@app.get("/", tags=["System"])
async def root() -> dict[str, str]:
    """Root info endpoint."""
    return {
        "name": "ScribeX Core VPS API",
        "version": "0.1.0",
        "docs_url": "/docs",
        "health_url": "/health",
    }


# Register API Routers
from app.api import intake, onboarding, sync_http, sync_ws

app.include_router(intake.router)
app.include_router(onboarding.router)
app.include_router(sync_http.router)
app.include_router(sync_ws.router)


