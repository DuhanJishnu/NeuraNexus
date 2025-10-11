import logging
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict
from dotenv import load_dotenv
from config import Config

# Load environment variables from .env file
load_dotenv()

# Add the project root to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '.')))

from api_client.api_client import get_files_from_api, update_status_via_api
# from models.document_ingestor import DocumentIngestor
from models.document_ingestor_timestamp import DocumentIngestor
from models.vector_store import VectorDB

class IngestionProcessor:
    """Processes a single document for ingestion."""

    def __init__(self, ingestor: DocumentIngestor, vector_db: VectorDB):
        self.ingestor = ingestor
        self.vector_db = vector_db

    def process(self, file_path: str) -> bool:
        """Process a single file and add it to the vector DB."""
        if not os.path.exists(file_path):
            logging.error("File not found: %s", file_path)
            raise FileNotFoundError(f"File not found: {file_path}")

        file_metadata = {
            "file_id": os.path.basename(os.path.splitext(file_path)[0]), # save only doc_id
            "saved_path": file_path,
            "upload_timestamp": os.path.getmtime(file_path),
        }

        try:
            chunks = self.ingestor.ingest_file(file_path, file_metadata)
            if not chunks:
                logging.warning("No chunks generated for file: %s", file_path)
                return False

            embedded_chunks = self.ingestor.embed_chunks(chunks)
            if not embedded_chunks:
                logging.warning("Embedding failed or returned no data for file: %s", file_path)
                return False

            self.vector_db.add_documents(embedded_chunks)

            # Remove file from server after ingestion
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
                    # print(f"Removed: {file_path}")

                root, ext = os.path.splitext(file_path)
                if ext == ".wav":
                    denoised_file = root + "_denoised" + ext

                if os.path.exists(denoised_file):
                    os.remove(denoised_file)
                    # print(f"Removed: {denoised_file}")

                logging.info("Successfully processed and removed file: %s", file_path)

            except Exception as e:
                logging.error("Processed but failed to delete file %s: %s", file_path, e)

            logging.info("Successfully processed file: %s", file_path)
            return True

        except Exception as e:
            logging.exception("Error while processing file %s: %s", file_path, e)
            return False

def process_batch_parallel(
        file_paths: List[str],
        ingestor: DocumentIngestor,
        vector_db: VectorDB,
        max_workers: int = 4
        )->tuple[list[str], Dict[str,str]]:
    """Process a batch of files in parallel."""
    processor = IngestionProcessor(ingestor, vector_db)
    successful_files = []
    failed_files = {}

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_file = {
            executor.submit(processor.process, file_path): file_path
            for file_path in file_paths
        }

        for future in as_completed(future_to_file):
            file_path = future_to_file[future]
            try:
                success = future.result()
                if success:
                    
                    successful_files.append(file_path)
                else:
                    failed_files[file_path] = "Processing failed (check logs)"
            except Exception as e:
                logging.error(f"Error processing {file_path}: {e}")
                failed_files[file_path] = str(e)

    return successful_files, failed_files

def start_worker_service(batch_size: int = Config.BATCH_SIZE, poll_interval: int = Config.POLL_INTERVAL, max_workers: int = Config.MAX_WORKERS):

    """Main continuous loop for the processing worker service."""

    logging.info("Ingestion worker service starting.")

    ingestor = DocumentIngestor(upload_folder=Config.UPLOAD_FOLDER) # taking files from 'uploads' folder
    vector_db = VectorDB()

    while True:
        try:
            files_to_process = get_files_from_api(batch_size)

            if not files_to_process:
                logging.info(f"No pending files found. Sleeping for {poll_interval} seconds...")
                time.sleep(poll_interval)
                continue

            logging.info(f"Fetched {len(files_to_process)} files for processing.")

            successful_files, failed_files = process_batch_parallel(files_to_process, ingestor, vector_db, max_workers)

            # Report status back to the API
            for file_path in successful_files:
                update_status_via_api(file_path, success=True)
            for file_path in failed_files:
                update_status_via_api(file_path, success=False)

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
