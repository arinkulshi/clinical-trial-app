"""GCS upload helper. Falls back to local storage when GCS is unavailable."""

import logging
import os
from pathlib import Path

log = logging.getLogger(__name__)

# Local fallback directory for uploads when GCS isn't configured
LOCAL_UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"


async def upload_to_gcs(
    bucket_name: str,
    destination_path: str,
    content: bytes,
) -> str:
    """
    Upload file content to GCS.

    Returns the GCS URI (gs://bucket/path) on success,
    or a local file path as fallback.
    """
    try:
        from google.cloud import storage

        client = storage.Client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(destination_path)
        blob.upload_from_string(content)
        uri = f"gs://{bucket_name}/{destination_path}"
        log.info("Uploaded to GCS: %s", uri)
        return uri
    except Exception as exc:
        log.warning("GCS upload failed (%s), using local storage", exc)
        return await _save_local(destination_path, content)


async def _save_local(destination_path: str, content: bytes) -> str:
    """Save file locally as a GCS fallback."""
    local_path = LOCAL_UPLOAD_DIR / destination_path
    local_path.parent.mkdir(parents=True, exist_ok=True)
    local_path.write_bytes(content)
    log.info("Saved locally: %s", local_path)
    return str(local_path)


async def delete_from_gcs(bucket_name: str, path: str) -> None:
    """Delete a file from GCS (or local fallback)."""
    try:
        from google.cloud import storage

        client = storage.Client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(path)
        blob.delete()
        log.info("Deleted from GCS: gs://%s/%s", bucket_name, path)
    except Exception as exc:
        log.warning("GCS delete failed (%s), trying local", exc)
        local_path = LOCAL_UPLOAD_DIR / path
        if local_path.exists():
            local_path.unlink()
