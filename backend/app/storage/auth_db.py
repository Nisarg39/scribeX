"""SQLite Database for Central User Authentication."""

from pathlib import Path
from typing import Any
import aiosqlite
import secrets
from app.core.config import settings
from app.core.security import hash_password, verify_password


def get_auth_db_path() -> Path:
    """Return path to central auth database: data/sqlite/auth.db."""
    sqlite_dir = settings.data_dir.resolve() / "sqlite"
    sqlite_dir.mkdir(parents=True, exist_ok=True)
    return sqlite_dir / "auth.db"


async def init_auth_db() -> None:
    """Initialize the users table in auth.db."""
    db_path = get_auth_db_path()
    async with aiosqlite.connect(str(db_path)) as db:
        await db.execute("PRAGMA journal_mode = WAL;")
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        await db.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);")
        await db.commit()


async def get_user_by_email(email: str) -> dict[str, Any] | None:
    """Lookup a user record by email."""
    normalized_email = email.strip().lower()
    db_path = get_auth_db_path()
    async with aiosqlite.connect(str(db_path)) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM users WHERE email = ? LIMIT 1;",
            (normalized_email,),
        ) as cursor:
            row = await cursor.fetchone()
            if row:
                return dict(row)
            return None


async def get_user_by_id(user_id: str) -> dict[str, Any] | None:
    """Lookup a user record by ID."""
    db_path = get_auth_db_path()
    async with aiosqlite.connect(str(db_path)) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM users WHERE id = ? LIMIT 1;",
            (user_id,),
        ) as cursor:
            row = await cursor.fetchone()
            if row:
                return dict(row)
            return None


async def create_user(email: str, name: str, password: str) -> dict[str, Any]:
    """Create a new user account with secure password hashing.
    
    Raises:
        ValueError: If email is already registered.
    """
    normalized_email = email.strip().lower()
    existing = await get_user_by_email(normalized_email)
    if existing:
        raise ValueError("An account with this email address already exists.")

    user_id = f"usr_{secrets.token_hex(6)}"
    pwd_hash, salt = hash_password(password)

    db_path = get_auth_db_path()
    async with aiosqlite.connect(str(db_path)) as db:
        await db.execute(
            """
            INSERT INTO users (id, email, name, password_hash, salt)
            VALUES (?, ?, ?, ?, ?);
            """,
            (user_id, normalized_email, name.strip(), pwd_hash, salt),
        )
        await db.commit()

    return {
        "id": user_id,
        "email": normalized_email,
        "name": name.strip(),
        "created_at": None,
    }


async def authenticate_user(email: str, password: str) -> dict[str, Any] | None:
    """Verify credentials and return user profile without password hash."""
    user = await get_user_by_email(email)
    if not user:
        return None

    if not verify_password(password, user["password_hash"], user["salt"]):
        return None

    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "created_at": user["created_at"],
    }
