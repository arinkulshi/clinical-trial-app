"""Environment-based configuration for the FastAPI backend."""

from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # FHIR server
    fhir_server_url: str = "http://localhost:8080/fhir"

    # Database (app_metadata)
    database_url: str = "sqlite+aiosqlite:///./app_metadata.db"

    # GCS
    gcs_bucket: str = "ai-poc-project-483817-clinical-uploads"

    # CORS
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # Upload limits
    max_upload_size_mb: int = 50

    model_config = {"env_prefix": "CT_", "env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
