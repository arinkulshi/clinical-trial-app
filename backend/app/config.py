"""Environment-based configuration for the FastAPI backend."""

from functools import lru_cache
from typing import Any

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # FHIR server
    fhir_server_url: str = "http://localhost:8080/fhir"

    # Database (app_metadata)
    database_url: str = "sqlite+aiosqlite:///./app_metadata.db"

    # GCS
    gcs_bucket: str = "ai-poc-project-483817-clinical-uploads"

    # CORS — set CT_CORS_ORIGINS="*" for open access or comma-separated list
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # Upload limits
    max_upload_size_mb: int = 50

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors(cls, v: Any) -> list[str]:
        if isinstance(v, str):
            return [s.strip() for s in v.split(",")]
        return v

    model_config = {"env_prefix": "CT_", "env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
