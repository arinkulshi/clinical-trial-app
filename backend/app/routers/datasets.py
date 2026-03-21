"""Dataset registry CRUD endpoints."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..models.database import Dataset, get_db
from ..models.schemas import DatasetListResponse, DatasetResponse

router = APIRouter(prefix="/api/datasets", tags=["datasets"])
log = logging.getLogger(__name__)


@router.get("/", response_model=DatasetListResponse)
async def list_datasets(db: AsyncSession = Depends(get_db)):
    """List all datasets with status."""
    result = await db.execute(
        select(Dataset).order_by(Dataset.created_at.desc())
    )
    datasets = result.scalars().all()
    return DatasetListResponse(
        datasets=[DatasetResponse.model_validate(d) for d in datasets],
        total=len(datasets),
    )


@router.get("/{dataset_id}", response_model=DatasetResponse)
async def get_dataset(dataset_id: str, db: AsyncSession = Depends(get_db)):
    """Get dataset details including validation report."""
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return DatasetResponse.model_validate(dataset)


@router.delete("/{dataset_id}")
async def delete_dataset(dataset_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a dataset (metadata only; FHIR resources are not removed)."""
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Optionally delete from GCS
    if dataset.gcs_path:
        try:
            from ..services.gcs import delete_from_gcs

            settings = get_settings()
            for path in dataset.gcs_path.split("; "):
                # Strip gs://bucket/ prefix if present
                clean = path.replace(f"gs://{settings.gcs_bucket}/", "")
                await delete_from_gcs(settings.gcs_bucket, clean)
        except Exception as exc:
            log.warning("GCS cleanup failed for dataset %s: %s", dataset_id, exc)

    await db.execute(delete(Dataset).where(Dataset.id == dataset_id))
    await db.commit()

    return {"detail": "Dataset deleted", "id": dataset_id}
