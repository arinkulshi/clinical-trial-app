"""Environment-based configuration for the FastAPI backend."""

from functools import lru_cache
from typing import Any

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # FHIR server
    fhir_server_url: str = "http://localhost:8080/fhir"

    # Database (app_metadata)
    database_url: str = "sqlite+aiosqlite:///./app_metadata.db"

    # GCS
    gcs_bucket: str = "ai-poc-project-483817-clinical-uploads"

    # CORS — set CT_CORS_ORIGINS="*" for open access or comma-separated list
    cors_origins: Any = ["http://localhost:5173", "http://localhost:3000"]

    # Upload limits
    max_upload_size_mb: int = 50

    # AI assistant
    llm_provider: str = Field(
        "gemini",
        validation_alias=AliasChoices("CT_LLM_PROVIDER", "LLM_PROVIDER"),
    )
    gemini_api_key: str | None = Field(
        None,
        validation_alias=AliasChoices("CT_GEMINI_API_KEY", "GEMINI_API_KEY"),
    )
    gemini_model: str = Field(
        "gemini-2.5-flash-lite",
        validation_alias=AliasChoices("CT_GEMINI_MODEL", "GEMINI_MODEL"),
    )
    assistant_demo_mode: bool = Field(
        False,
        validation_alias=AliasChoices("CT_ASSISTANT_DEMO_MODE", "ASSISTANT_DEMO_MODE"),
    )
    assistant_max_tool_results: int = Field(
        500,
        validation_alias=AliasChoices("CT_ASSISTANT_MAX_TOOL_RESULTS", "ASSISTANT_MAX_TOOL_RESULTS"),
    )
    assistant_timeout_seconds: int = Field(
        45,
        validation_alias=AliasChoices("CT_ASSISTANT_TIMEOUT_SECONDS", "ASSISTANT_TIMEOUT_SECONDS"),
    )

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
