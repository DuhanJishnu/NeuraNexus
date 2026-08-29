import os
import json
import logging
import mimetypes
import requests
from dataclasses import dataclass
from typing import List, Optional

API_BASE_URL = os.environ.get("API_URL")
SERVICE_TOKEN = os.environ.get("INGESTION_SERVICE_TOKEN")


@dataclass(frozen=True)
class IngestionJob:
    document_id: str
    document_type: int
    processing_lease_id: str
    file_path: str
    target_index_version: Optional[str] = None
    visibility: str = "GLOBAL"
    owner_id: Optional[str] = None


def _service_headers() -> dict:
    if not SERVICE_TOKEN:
        raise RuntimeError("INGESTION_SERVICE_TOKEN is required")
    return {"Authorization": f"Bearer {SERVICE_TOKEN}"}

def get_files_from_api(batch_size: int) -> List[IngestionJob]:
    """
    Atomically claimed documents are downloaded and returned with their lease.
    """
    try:
        endpoint = f"{API_BASE_URL}/api/file/v1/unprocessed"
        params = {"batch_size": batch_size}
        resp = requests.get(
            endpoint,
            params=params,
            headers=_service_headers(),
            timeout=15,
        )
        resp.raise_for_status()

        files = resp.json()
        if not isinstance(files, list):
            logging.warning("API returned non-list data: %s", files)
            return []

        jobs = []
        for doc in files:
            if not isinstance(doc, dict):
                continue
            doc_id = doc.get("documentEncryptedId")
            doc_type = doc.get("documentType")
            processing_lease_id = doc.get("processingLeaseId")
            if (
                not doc_id
                or not processing_lease_id
                or not isinstance(doc_type, int)
            ):
                logging.warning("Skipping malformed ingestion claim: %s", doc)
                continue

            url = f"{API_BASE_URL}/api/file/v1/files/{doc_id}"
            saved = download_file(url, doc_id, doc_type)
            if saved:
                jobs.append(IngestionJob(
                    document_id=doc_id,
                    document_type=doc_type,
                    processing_lease_id=processing_lease_id,
                    file_path=saved,
                    target_index_version=doc.get("targetIndexVersion"),
                    visibility=doc.get("visibility", "GLOBAL"),
                    owner_id=doc.get("ownerId"),
                ))
            else:
                # The Node API atomically marks fetched work as PROCESSING. If
                # download fails, release that lease so the job can be retried.
                update_status_by_id(
                    doc_id, processing_lease_id, success=False
                )

        return jobs

    except requests.RequestException as e:
        logging.error("Error fetching files from API: %s", e)
        return []

def download_file(url: str, document_id: str, document_type: str) -> Optional[str]:
    """
    Download `url` and save it to uploads/<document_id>{.ext_if_detected}.
    Returns absolute path to saved file or None on failure.
    """
    try:
        resp = requests.get(
            url,
            headers=_service_headers(),
            stream=True,
            timeout=60,
        )
        resp.raise_for_status()

        # uploads folder relative to project root (one level up from this file)
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        uploads_folder = os.path.join(project_root, "uploads")
        doc_type_upload_folder = os.path.join(uploads_folder, str(document_type) or "others")
        os.makedirs(doc_type_upload_folder, exist_ok=True)

        content_type = resp.headers.get("content-type", "").split(";")[0].strip()
        fallback_map = {
            "image/webp": ".webp",
        }

        ext = mimetypes.guess_extension(content_type) or fallback_map.get(content_type, "")

        # Build filename using document id
        filename = f"{document_id}{ext}"
        save_path = os.path.join(doc_type_upload_folder, filename)

        # Write stream to disk
        with open(save_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)

        logging.info("Saved file %s", save_path)
        return save_path

    except requests.RequestException as e:
        logging.error("HTTP error while downloading %s: %s", url, e)
        return None
    except OSError as e:
        logging.error("Filesystem error while saving file %s: %s", document_id, e)
        return None

def update_status_via_api(
    document_id: str,
    processing_lease_id: str,
    success: bool,
    vector_manifest: Optional[dict] = None,
) -> bool:
    """
    Report a terminal status for one fenced ingestion attempt.

    Args:
        document_id: The ID of the file that was processed.
        processing_lease_id: The unique token returned when work was claimed.
        success: True if processing was successful, False otherwise.

    Returns:
        True if the status was reported successfully, False otherwise.
    """

    return update_status_by_id(
        document_id, processing_lease_id, success, vector_manifest
    )


def update_status_by_id(
    doc_id: str,
    processing_lease_id: str,
    success: bool,
    vector_manifest: Optional[dict] = None,
) -> bool:
    """Report ingestion completion for a document ID."""
    try:
        url = f"{API_BASE_URL}/api/file/v1/update-status"
        status_payload = {
            "documentId": doc_id,
            "processingLeaseId": processing_lease_id,
            "status": "COMPLETED" if success else "FAILED",
        }
        if success:
            if not vector_manifest:
                raise ValueError("vector_manifest is required for successful ingestion")
            status_payload["vectorManifest"] = vector_manifest
        payload = json.dumps(status_payload)

        headers = {
            'Content-Type': 'application/json',
            **_service_headers(),
        }
        # response = requests.post(endpoint, json=payload, timeout=15)
        response = requests.request(
            "PATCH", url, headers=headers, data=payload, timeout=15
        )
        response.raise_for_status()
        return True
    except requests.exceptions.RequestException as e:
        logging.error(f"Error updating status for {doc_id}: {e}")
        return False


def heartbeat_lease(
    document_id: str, processing_lease_id: str
) -> Optional[bool]:
    """Renew a processing lease while a long-running ingestion is active."""
    try:
        response = requests.patch(
            f"{API_BASE_URL}/api/file/v1/heartbeat",
            headers={"Content-Type": "application/json", **_service_headers()},
            json={
                "documentId": document_id,
                "processingLeaseId": processing_lease_id,
            },
            timeout=15,
        )
        if response.status_code == 409:
            return False
        response.raise_for_status()
        return True
    except requests.RequestException as error:
        logging.warning("Failed to renew ingestion lease for %s: %s", document_id, error)
        return None
