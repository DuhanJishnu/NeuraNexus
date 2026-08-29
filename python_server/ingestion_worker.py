import logging
import os
import sys
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Callable, List, Dict, Optional
from dotenv import load_dotenv
from config import Config

# Load environment variables from .env file
load_dotenv()

# Add the project root to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '.')))

from api_client.api_client import IngestionJob, get_files_from_api, heartbeat_lease, update_status_via_api
# from models.document_ingestor import DocumentIngestor
from models.document_ingestor_timestamp import DocumentIngestor
from models.vector_store import VectorDB

class IngestionProcessor:
    """Processes a single document for ingestion."""

    def __init__(self, ingestor: DocumentIngestor, vector_db: VectorDB):
        self.ingestor = ingestor
        self.vector_dbs = {vector_db.index_version: vector_db}
        self.vector_db_lock = threading.Lock()

    def _vector_db_for(self, index_version: str) -> VectorDB:
        with self.vector_db_lock:
            vector_db = self.vector_dbs.get(index_version)
            if vector_db is None:
                vector_db = VectorDB(index_version=index_version)
                self.vector_dbs[index_version] = vector_db
            return vector_db

    def process(
        self,
        file_path: str,
        target_index_version: Optional[str] = None,
        visibility: str = "GLOBAL",
        owner_id: Optional[str] = None,
        lease_is_valid: Optional[Callable[[], bool]] = None,
    ) -> Optional[Dict[str, Any]]:
        """Process a single file and add it to the vector DB."""
        if not os.path.exists(file_path):
            logging.error("File not found: %s", file_path)
            raise FileNotFoundError(f"File not found: {file_path}")

        file_metadata = {
            "file_id": os.path.basename(os.path.splitext(file_path)[0]), # save only doc_id
            "saved_path": file_path,
            "upload_timestamp": os.path.getmtime(file_path),
            "visibility": visibility,
            "owner_id": owner_id,
        }

        try:
            index_version = target_index_version or Config.INDEX_VERSION
            vector_db = self._vector_db_for(index_version)
            if target_index_version:
                # A requested reindex replaces any partial or prior vectors in
                # the target index before rebuilding its manifest.
                vector_db.delete_document(file_metadata["file_id"])

            chunks = self.ingestor.ingest_file(file_path, file_metadata)
            if not chunks:
                logging.warning("No chunks generated for file: %s", file_path)
                return None

            embedded_chunks = self.ingestor.embed_chunks(chunks)
            if not embedded_chunks:
                logging.warning("Embedding failed or returned no data for file: %s", file_path)
                return None

            if lease_is_valid and not lease_is_valid():
                raise RuntimeError("Ingestion lease was lost before vector upsert")
            vector_ids = vector_db.add_documents(embedded_chunks)

            # Remove file from server after ingestion
            try:
                self._cleanup_processed_files(file_path)
                
                logging.info("Successfully processed and removed file: %s", file_path)

            except Exception as e:
                logging.error("Processed but failed to delete file %s: %s", file_path, e)

            logging.info("Successfully processed file: %s", file_path)
            return {
                "vectorIdPrefix": f"{file_metadata['file_id']}:",
                "chunkCount": len(vector_ids),
                "embeddingModel": Config.EMBEDDING_MODEL,
                "indexVersion": index_version,
            }

        except Exception as e:
            logging.exception("Error while processing file %s: %s", file_path, e)
            return None
        
    def _cleanup_processed_files(self, file_path: str):
        """Clean up original and temporary processed files."""
        try:
            files_to_remove = [file_path]
            
            # Check for denoised audio files
            root, ext = os.path.splitext(file_path)
            if ext.lower() in [".wav", ".mp3", ".flac", ".m4a"]:
                denoised_file = root + "_denoised.wav"
                files_to_remove.append(denoised_file)
            
            # Remove all files that exist
            for file_to_remove in files_to_remove:
                if os.path.exists(file_to_remove):
                    os.remove(file_to_remove)
                    logging.debug("Removed: %s", file_to_remove)
                    
            logging.info("Successfully cleaned up files for: %s", file_path)
            
        except Exception as e:
            logging.error("Cleanup failed for %s: %s", file_path, e)

def process_batch_parallel(
        jobs: List[IngestionJob],
        ingestor: DocumentIngestor,
        vector_db: VectorDB,
        max_workers: int = 4
        )->tuple[Dict[IngestionJob, Dict[str, Any]], Dict[IngestionJob, str]]:
    """Process a batch of files in parallel."""
    processor = IngestionProcessor(ingestor, vector_db)
    successful_files = {}
    failed_files = {}

    def process_with_heartbeat(job: IngestionJob):
        stopped = threading.Event()
        lease_lost = threading.Event()

        def renew_lease():
            while not stopped.wait(Config.LEASE_HEARTBEAT_SECONDS):
                renewed = heartbeat_lease(job.document_id, job.processing_lease_id)
                if renewed is False:
                    lease_lost.set()
                    return

        if heartbeat_lease(job.document_id, job.processing_lease_id) is False:
            return None

        heartbeat_thread = threading.Thread(target=renew_lease, daemon=True)
        heartbeat_thread.start()
        try:
            return processor.process(
                job.file_path,
                job.target_index_version,
                job.visibility,
                job.owner_id,
                lease_is_valid=lambda: not lease_lost.is_set(),
            )
        finally:
            stopped.set()
            heartbeat_thread.join(timeout=1)

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_job = {
            executor.submit(process_with_heartbeat, job): job
            for job in jobs
        }

        for future in as_completed(future_to_job):
            job = future_to_job[future]
            try:
                manifest = future.result()
                if manifest:
                    successful_files[job] = manifest
                else:
                    failed_files[job] = "Processing failed (check logs)"
            except Exception as e:
                logging.error("Error processing %s: %s", job.file_path, e)
                failed_files[job] = str(e)

    return successful_files, failed_files

def start_worker_service(batch_size: int = Config.BATCH_SIZE, poll_interval: int = Config.POLL_INTERVAL, max_workers: int = Config.MAX_WORKERS):

    """Main continuous loop for the processing worker service."""

    if not 10 <= Config.LEASE_HEARTBEAT_SECONDS <= 600:
        raise ValueError("LEASE_HEARTBEAT_SECONDS must be between 10 and 600")
    logging.info("Ingestion worker service starting.")

    ingestor = DocumentIngestor(upload_folder=Config.UPLOAD_FOLDER) # taking files from 'uploads' folder
    vector_db = VectorDB()

    while True:
        try:
            jobs_to_process = get_files_from_api(batch_size)

            if not jobs_to_process:
                logging.info(f"No pending files found. Sleeping for {poll_interval} seconds...")
                time.sleep(poll_interval)
                continue

            logging.info("Fetched %s files for processing.", len(jobs_to_process))

            successful_files, failed_files = process_batch_parallel(
                jobs_to_process, ingestor, vector_db, max_workers
            )

            # Report status back to the API
            for job, manifest in successful_files.items():
                update_status_via_api(
                    job.document_id,
                    job.processing_lease_id,
                    success=True,
                    vector_manifest=manifest,
                )
            for job in failed_files:
                update_status_via_api(
                    job.document_id, job.processing_lease_id, success=False
                )

            # Save the updated vector database to disk
            if successful_files:
                vector_db.save()

        except Exception as e:
            logging.critical(f"An unhandled exception occurred in the worker loop: {e}", exc_info=True)
            time.sleep(poll_interval)

if __name__ == "__main__":
    # logging in terminal
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
    start_worker_service()
