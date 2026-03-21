"""FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .middleware.error_handler import ErrorHandlerMiddleware
from .models.database import close_db, init_db
from .routers import datasets, fhir_proxy, upload

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize and tear down resources."""
    settings = get_settings()
    log.info("Starting up — FHIR server: %s", settings.fhir_server_url)
    await init_db(settings.database_url)
    log.info("Database initialized")
    yield
    await close_db()
    log.info("Shut down complete")


app = FastAPI(
    title="Clinical Trial FHIR Dashboard API",
    description="API layer between the React dashboard and the HAPI FHIR server",
    version="1.0.0",
    lifespan=lifespan,
)

# Middleware
app.add_middleware(ErrorHandlerMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(fhir_proxy.router)
app.include_router(upload.router)
app.include_router(datasets.router)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "clinical-trial-backend"}
