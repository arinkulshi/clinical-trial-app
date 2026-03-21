"""SQLAlchemy models for the app_metadata database."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Column, DateTime, String
from sqlalchemy.dialects.sqlite import CHAR
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker


class Base(DeclarativeBase):
    pass


class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    study_name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    upload_timestamp = Column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    status = Column(String, default="VALIDATING")
    file_type = Column(String)  # csv_bundle, xlsx, fhir_json
    gcs_path = Column(String, nullable=True)
    fhir_research_study_id = Column(String, nullable=True)
    validation_report = Column(JSON, nullable=True)
    row_counts = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


# Async engine and session factory — initialized at app startup
_engine = None
_async_session_factory = None


async def init_db(database_url: str) -> None:
    """Create engine, session factory, and tables."""
    global _engine, _async_session_factory
    _engine = create_async_engine(database_url, echo=False)
    _async_session_factory = sessionmaker(
        _engine, class_=AsyncSession, expire_on_commit=False
    )
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db() -> None:
    global _engine
    if _engine:
        await _engine.dispose()


async def get_db() -> AsyncSession:
    """Yield an async database session (FastAPI dependency)."""
    async with _async_session_factory() as session:
        yield session
