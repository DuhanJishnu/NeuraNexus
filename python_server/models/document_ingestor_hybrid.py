import os
import uuid
import json
import wave
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from concurrent.futures import ThreadPoolExecutor

import torch
import numpy as np
from scipy.io import wavfile
import pytesseract
import noisereduce as nr
from PIL import Image
from PyPDF2 import PdfReader
import docx
from vosk import Model, KaldiRecognizer
from sentence_transformers import SentenceTransformer
from transformers import BlipProcessor, BlipForConditionalGeneration
from langchain_community.document_loaders import (
    PyPDFLoader,
    UnstructuredWordDocumentLoader,
    UnstructuredPowerPointLoader
)
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_ollama import OllamaEmbeddings
from .hybrid_embedding_service import HybridEmbeddingService

from config import Config

API_BASE_URL = os.environ.get("API_URL")

class DocumentIngestor:
    """Handles ingestion and processing of various document types including text, images, and audio."""

    def __init__(
        self,
        upload_folder: str,
        text_embedding_model: str = Config.EMBEDDING_MODEL,
        image_embedder_name: str = "clip-ViT-L-14", # 768 D
        caption_model_name: str = "Salesforce/blip-image-captioning-large",
        device: Optional[str] = None,
        audio_model_path: str = r"E:\SIH_25\python_server\models\vosk-model-small-en-us-0.15",
        text_vector_field: str = "embedding_text",
        image_vector_field: str = "embedding_image",
        hybrid_search_enabled: bool = True,
    ):
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.hybrid_search_enabled = hybrid_search_enabled

        self.upload_folder = upload_folder
        self.ts_format = "%Y%m%d_%H%M%S"

        self.text_vector_field = text_vector_field
        self.image_vector_field = image_vector_field
        os.makedirs(upload_folder, exist_ok=True)
        self._initialize_models(text_embedding_model, image_embedder_name, caption_model_name,audio_model_path)
        self._initialize_text_processor()
        
        # Initialize hybrid embedding service
        self.embedding_service = HybridEmbeddingService(model_name=text_embedding_model)

    def _initialize_models(self, text_embedding_model: str, image_embedder_name: str, caption_model_name: str, audio_model_path: str):
        """Initialize all required models and processors."""
        # Text embedding model - now handled by HybridEmbeddingService
        self.text_embedder = OllamaEmbeddings(model=text_embedding_model)

        # Image models
        self.image_embedder = SentenceTransformer(image_embedder_name)

        # BLIP captioning
        self.caption_processor = BlipProcessor.from_pretrained(caption_model_name, use_fast=True)
        self.caption_model = BlipForConditionalGeneration.from_pretrained(caption_model_name).to(self.device)

        # Object detection
        try:
            from ultralytics import YOLO
            self._object_detector = YOLO("yolov8n.pt")
        except Exception:
            self._object_detector = None

        # Audio model -> Vosk
        print(f"Loading Vosk model from: {audio_model_path}")
        self.vosk_model = Model(audio_model_path)
        print("Vosk model loaded successfully.")

    def _initialize_text_processor(self):
        """Initialize text splitting and processing components."""
        self.splitter = RecursiveCharacterTextSplitter(chunk_size=Config.CHUNK_SIZE, chunk_overlap=Config.CHUNK_OVERLAP)

    def search_documents(self, 
                        query: str, 
                        chunks: List[Dict], 
                        top_k: int = 10,
                        fusion_method: str = "auto",
                        alpha: float = 0.4) -> List[Tuple[Dict, float, Dict]]:
        """
        Perform hybrid search across document chunks
        
        Returns:
            List of (chunk, score, search_info) tuples
        """
        if not self.hybrid_search_enabled:
            # Fallback to dense-only search
            results = self.embedding_service._dense_retrieval(query, chunks)
            scored_chunks = list(zip(chunks, results))
            scored_chunks.sort(key=lambda x: x[1], reverse=True)
            return [(chunk, score, {"method": "dense_only"}) for chunk, score in scored_chunks[:top_k]]
        
        # Analyze query for optimal search parameters
        if fusion_method == "auto":
            query_analysis = self.embedding_service.analyze_query_type(query)
            fusion_method = query_analysis["fusion_method"]
            alpha = query_analysis["alpha"]
            query_type = query_analysis["query_type"]
        else:
            query_type = "manual"
        
        # Perform hybrid search
        search_results = self.embedding_service.hybrid_search(
            query=query,
            chunks=chunks,
            top_k=top_k,
            fusion_method=fusion_method,
            alpha=alpha
        )
        
        # Add search metadata
        enhanced_results = []
        for chunk, score in search_results:
            search_info = {
                "method": "hybrid",
                "fusion_method": fusion_method,
                "alpha": alpha,
                "query_type": query_type,
                "chunk_type": chunk.get("type", "unknown"),
                "has_timestamps": "start_time" in chunk.get("metadata", {})
            }
            enhanced_results.append((chunk, score, search_info))
        
        return enhanced_results

    def embed_chunks(self, chunks: List[Dict[str, Any]], remove_image_obj: bool = True) -> List[Dict[str, Any]]:
        """
        Embeds a list of chunks. Batches text embeddings for efficiency where possible.
        Behaviour:
        - text-like chunks (type in text, image_caption, image_tags, image_ocr) get a text embedding stored in the field specified by `text_vector_field`.
        - image chunks get an image embedding stored in the field specified by `image_vector_field`.
        """

        # Separate chunks by type for optimized processing
        text_chunks = []
        image_chunks = []
        image_indices = []

        for i, chunk in enumerate(chunks):
            chunk_type = chunk.get("type")
            if chunk_type == "image":
                image_chunks.append(chunk)
                image_indices.append(i)
            else:
                text_chunks.append(chunk)

        # Process text chunks in parallel
        text_results = self._embed_text_chunks_parallel(text_chunks)

        # Process image chunks in batches
        image_results = self._embed_image_chunks_batched(image_chunks)

        # Recombine results in original order
        result_chunks = [None] * len(chunks)

        # Place text chunks
        text_idx = 0
        image_idx = 0
        for i, chunk in enumerate(chunks):
            if chunk.get("type") == "image":
                result_chunks[i] = image_results[image_idx]
                image_idx += 1
            else:
                result_chunks[i] = text_results[text_idx]
                text_idx += 1

        # Remove image objects if requested
        if remove_image_obj:
            for chunk in result_chunks:
                chunk.pop("_image_obj", None)

        return result_chunks

    def ingest_file(self, file_path: str, file_metadata: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Extract and process file into structured chunks.
        Args:
            file_path: Path to the file to process
            file_metadata: Metadata about the file
        Returns:
            List of processed chunks with metadata and content
        """
        file_ext = file_path.lower().split('.')[-1]
        structured_chunks: List[Dict[str, Any]] = []

        processors = {
            'image': self._process_image_file,
            'pdf': self._extract_pdf_text,
            'docx': self._extract_docx_text,
            'audio': self._process_audio_file,
            'pptx': self._process_pptx_file,
            'txt': self._extract_txt_text
        }

        # Determine file type and process accordingly
        if file_ext in ("png", "jpg", "jpeg", "bmp", "gif", "tiff", "webp"):
            structured_chunks.extend(processors['image'](file_path, file_metadata))
        elif file_ext == "pdf":
            structured_chunks.extend(processors['pdf'](file_path, file_metadata))
        elif file_ext == "docx":
            structured_chunks.extend(processors['docx'](file_path, file_metadata))
        elif file_ext in ("wav", "mp3", "flac", "m4a"):
            structured_chunks.extend(processors['audio'](file_path, file_metadata))
        elif file_ext == "pptx":
            structured_chunks.extend(processors['pptx'](file_path, file_metadata))
        elif file_ext == "txt":
            structured_chunks.extend(processors['txt'](file_path, file_metadata))
        else:
            # Fallback processing for unsupported types
            structured_chunks.extend(self._fallback_processing(file_path, file_metadata, file_ext))

        return structured_chunks

    def _process_image_file(self, image_path: str, file_metadata: Dict) -> List[Dict]:
        """Process image file to extract caption and OCR text."""
        img = Image.open(image_path).convert("RGB")

        # OCR && CAPTION && OBJECTS
        ocr_text = self._extract_ocr_text(img)
        caption = self._generate_image_caption(img)
        tags = self._extract_image_tags(img)

        return self._create_image_chunks(file_metadata, image_path, img, caption, ocr_text, tags)

    def _generate_image_caption(self, img: Image.Image) -> str:
        """Generate caption for image using BLIP model."""
        try:
            inputs = self.caption_processor(images=img, return_tensors="pt")
            out = self.caption_model.generate(**inputs)
            return self.caption_processor.decode(out[0], skip_special_tokens=True)
        except Exception:
            return ""

    def _extract_image_tags(self, img: Image.Image) -> List[str]:
        """Extract object tags from image using YOLO model."""
        if self._object_detector is None:
            return []

        try:
            results = self._object_detector(img)
            labels = []
            for r in results:
                for box in r.boxes:
                    label = r.names[int(box.cls)] if hasattr(r, 'names') else None
                    if label:
                        labels.append(label)
            return list(dict.fromkeys(labels)) # dedupe
        except Exception:
            return []

    def _extract_ocr_text(self, img: Image.Image) -> str:
        """Extract text from image using OCR."""
        try:
            return pytesseract.image_to_string(img).strip()
        except Exception:
            return ""


    def _create_image_chunks(self, file_metadata: Dict, image_path: str, img: Image.Image, caption: str, ocr_text: str, tags: List[str]) -> List[Dict]:
        """Create structured chunks for image data."""
        chunks = []

        # caption chunk (text embed)
        if caption:
            chunks.append(self._create_chunk(
                chunk_type="image_caption",
                content=caption,
                file_metadata=file_metadata,
                additional_metadata={"chunk_type": "image_caption"}
            ))

        # tags chunk (text embed)
        if tags:
            chunks.append(self._create_chunk(
                chunk_type="image_tags",
                content=", ".join(tags),
                file_metadata=file_metadata,
                additional_metadata={"chunk_type": "image_tags", "tags": tags}
        ))

        # OCR chunk (text embed)
        if ocr_text:
            chunks.append(self._create_chunk(
                chunk_type="image_ocr",
                content=ocr_text,
                file_metadata=file_metadata,
                additional_metadata={"chunk_type": "image_ocr"}
            ))

        # Image raw object chunk
        chunks.append({
            "type": "image",
            "content": caption or "",
            "metadata": {
                "chunk_id": str(uuid.uuid4()),
                "file_id": file_metadata["file_id"],
                "chunk_type": "image_raw",
                "upload_timestamp": file_metadata["upload_timestamp"],
                "source_url": f"{API_BASE_URL}/api/file/v1/files/{file_metadata['file_id']}",
                "tags": tags
            },
            "_image_obj": img
        })

        return chunks

    def _extract_pdf_text(self, file_path: str, file_metadata: Dict) -> List[Dict]:
        """Extract text from PDF with page-level metadata."""
        text_blocks = []
        pdf_reader = PdfReader(file_path)
        total_pages = len(pdf_reader.pages)

        for page_num, page in enumerate(pdf_reader.pages, start=1):
            text = page.extract_text() or ""
            if text.strip():
                docs = [{"page_content": text}]
                chunks = self._chunks_from_langchain_docs(
                    docs, file_metadata,
                    page_number=page_num,
                    total_pages=total_pages
                )
                text_blocks.extend(chunks)

        return text_blocks

    def _extract_docx_text(self, file_path: str, file_metadata: Dict) -> List[Dict]:
        """Extract text from DOCX file with paragraph-level metadata."""
        doc = docx.Document(file_path)
        paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
        combined = "\n\n".join(paragraphs)
        docs = [{"page_content": combined}]

        return self._chunks_from_langchain_docs(
            docs, file_metadata,
            total_paragraphs=len(paragraphs)
        )

    def _extract_txt_text(self, file_path: str, file_metadata: Dict) -> List[Dict]:
        """Extract text from TXT file."""
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        return [self._create_chunk(
            chunk_type="text",
            content=content,
            file_metadata=file_metadata,
            additional_metadata={"chunk_type": "full_text"}
        )]

    def _process_audio_file(self, file_path: str, file_metadata: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Process audio file and extract transcript with timestamps."""
        # Get transcript with word-level timestamps
        transcript_segments = self._transcribe_audio_vosk_with_timestamps(file_path)
        
        if not transcript_segments:
            return []
            
        # Combine segments into full transcript for chunking
        full_transcript = " ".join([seg["text"] for seg in transcript_segments])
        
        if not full_transcript.strip():
            return []
            
        # Split the full transcript into chunks
        chunks = self.splitter.split_text(full_transcript)
        structured_chunks = []

        # Map chunks back to timestamps
        current_pos = 0
        for i, chunk_text in enumerate(chunks):
            # Find which segments belong to this chunk
            chunk_segments = []
            chunk_start_time = None
            chunk_end_time = None
            
            # Simple mapping: find segments that contain the chunk text
            for segment in transcript_segments:
                segment_text = segment["text"]
                segment_start = segment["start"]
                segment_end = segment["end"]
                
                # Check if this segment overlaps with our current chunk position
                if (chunk_start_time is None and current_pos < len(full_transcript) and 
                    full_transcript[current_pos:current_pos + len(chunk_text)].find(segment_text) != -1):
                    
                    if chunk_start_time is None:
                        chunk_start_time = segment_start
                    chunk_end_time = segment_end
                    chunk_segments.append(segment)
            
            # Move current position forward
            current_pos += len(chunk_text) + 1  # +1 for space
            
            # If we couldn't map timestamps, use fallback
            if chunk_start_time is None or chunk_end_time is None:
                chunk_start_time = 0.0
                chunk_end_time = self._get_audio_duration(file_path)
            
            structured_chunks.append(self._create_chunk(
                chunk_type="audio_transcript",
                content=chunk_text,
                file_metadata=file_metadata,
                additional_metadata={
                    "chunk_type": "audio_transcript",
                    "chunk_id": i,
                    "start_time": round(chunk_start_time, 2),  # Round to 2 decimal places
                    "end_time": round(chunk_end_time, 2),
                    "duration": round(chunk_end_time - chunk_start_time, 2),
                    "timestamp_format": "seconds"
                }
            ))

        return structured_chunks

    def _get_audio_duration(self, file_path: str) -> float:
        """Get the duration of an audio file in seconds."""
        try:
            with wave.open(file_path, 'rb') as wf:
                frames = wf.getnframes()
                rate = wf.getframerate()
                return frames / float(rate)
        except Exception:
            # Fallback for non-wav files or if wave fails
            try:
                rate, data = wavfile.read(file_path)
                return len(data) / rate
            except Exception:
                return 0.0

    def _process_pptx_file(self, file_path: str, file_metadata: Dict) -> List[Dict]:
        """Process PowerPoint files using LangChain loader."""
        try:
            docs = UnstructuredPowerPointLoader(file_path).load()
            return self._chunks_from_langchain_docs(docs, file_metadata)
        except Exception as e:
            print(f"Error processing PPTX file: {e}")
            return []

    def _fallback_processing(self, file_path: str, file_metadata: Dict, file_ext: str) -> List[Dict]:
        """Fallback processing for unsupported file types using LangChain loaders."""
        try:
            docs = []
            if file_ext == "pdf":
                docs = PyPDFLoader(file_path).load()
            elif file_ext == "docx":
                docs = UnstructuredWordDocumentLoader(file_path).load()

            if docs:
                return self._chunks_from_langchain_docs(docs, file_metadata)
        except Exception as e:
            print(f"Fallback processing failed for {file_path}: {e}")

        return []

    def _chunks_from_langchain_docs(self, docs: List[Dict[str, Any]],
                            file_metadata: Dict[str, Any],
                            **additional_metadata) -> List[Dict]:
        """Convert LangChain documents to structured chunks."""
        combined_content = "\n\n".join([doc["page_content"] for doc in docs])
        split_docs = self.splitter.split_text(combined_content)
        chunks = []

        for i, chunk_text in enumerate(split_docs):
            meta = {
                "file_id": file_metadata["file_id"],
                "chunk_type": "text",
                "chunk_id": str(uuid.uuid4()),
                "upload_timestamp": file_metadata["upload_timestamp"],
                **additional_metadata
            }

            chunks.append({
                "type": "text",
                "content": chunk_text,
                "metadata": meta
            })

        return chunks

    def _create_chunk(self, chunk_type: str, content: str, file_metadata: Dict, additional_metadata: Dict) -> Dict:
        """Create a standardized chunk structure."""
        return {
            "type": chunk_type,
            "content": content,
            "metadata": {
                "chunk_id": str(uuid.uuid4()),
                "file_id": file_metadata["file_id"],
                "upload_timestamp": file_metadata["upload_timestamp"],
                "source_url": f"{API_BASE_URL}/api/file/v1/files/{file_metadata['file_id']}",
                **additional_metadata
            }
        }

    def _transcribe_audio_vosk_with_timestamps(self, file_path: str) -> List[Dict[str, Any]]:
        """Transcribe audio file using Vosk speech recognition with word-level timestamps."""
        # Apply noise reduction if needed
        file_path = self._apply_noise_reduction(file_path)

        # Perform speech recognition with timestamps
        return self._recognize_speech_with_timestamps(file_path)

    def _transcribe_audio_vosk(self, file_path: str) -> str:
        """Legacy method: Transcribe audio file using Vosk speech recognition (without timestamps)."""
        segments = self._transcribe_audio_vosk_with_timestamps(file_path)
        return " ".join([seg["text"] for seg in segments])

    def _apply_noise_reduction(self, file_path: str) -> str:
        """Apply noise reduction to audio file if needed."""
        try:
            rate, data = wavfile.read(file_path)
            if len(data.shape) > 1:
                data = data[:, 0]

            noise_level = np.mean(np.abs(data[:rate]))
            if noise_level > 500:
                reduced = nr.reduce_noise(y=data, sr=rate)
                base = os.path.splitext(file_path)[0]
                denoised_path = base + "_denoised.wav"
                wavfile.write(denoised_path, rate, reduced.astype(np.int16))
                return denoised_path
        except Exception as e:
            print(f"Noise reduction failed: {e}")

        return file_path

    def _recognize_speech_with_timestamps(self, file_path: str) -> List[Dict[str, Any]]:
        """Perform speech recognition on audio file with word-level timestamps."""
        wf = wave.open(file_path, "rb")
        rate = wf.getframerate()
        rec = KaldiRecognizer(self.vosk_model, rate)
        rec.SetWords(True)

        segments = []
        
        while True:
            data = wf.readframes(4000)
            if len(data) == 0:
                break
            if rec.AcceptWaveform(data):
                result = json.loads(rec.Result())
                if "result" in result:
                    # Extract words with timestamps
                    for word_info in result["result"]:
                        segments.append({
                            "text": word_info["word"],
                            "start": word_info["start"],
                            "end": word_info["end"],
                            "confidence": word_info.get("conf", 0.0)
                        })

        # Process final result
        final = json.loads(rec.FinalResult())
        if "result" in final:
            for word_info in final["result"]:
                segments.append({
                    "text": word_info["word"],
                    "start": word_info["start"],
                    "end": word_info["end"],
                    "confidence": word_info.get("conf", 0.0)
                })

        wf.close()
        return segments

    def _recognize_speech(self, file_path: str) -> str:
        """Legacy method: Perform speech recognition on audio file (without timestamps)."""
        wf = wave.open(file_path, "rb")
        rate = wf.getframerate()
        rec = KaldiRecognizer(self.vosk_model, rate)
        rec.SetWords(True)

        results = []
        while True:
            data = wf.readframes(4000)
            if len(data) == 0:
                break
            if rec.AcceptWaveform(data):
                result = json.loads(rec.Result())
                if "text" in result and result["text"].strip():
                    results.append(result["text"])

        final = json.loads(rec.FinalResult())
        if "text" in final and final["text"].strip():
            results.append(final["text"])

        wf.close()
        return " ".join(results).strip()

    # ------------------------------ EMBEDDING LOGIC ------------------------------ #

    def _embed_text_chunks_parallel(self, text_chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Embed text chunks in parallel using ThreadPoolExecutor."""
        if not text_chunks:
            return []

        # Use ThreadPoolExecutor for parallel text embedding
        with ThreadPoolExecutor(max_workers=min(len(text_chunks), 4)) as executor:
            futures = []
            for chunk in text_chunks:
                future = executor.submit(self._embed_single_text_chunk, chunk)
                futures.append(future)

            # Collect results
            results = [future.result() for future in futures]

        return results

    def _embed_single_text_chunk(self, chunk: Dict[str, Any]) -> Dict[str, Any]:
        """Embed a single text chunk."""
        chunk = dict(chunk)  # Shallow copy
        chunk.pop("vector", None)  # Remove existing vector

        try:
            # Text-based embedding
            vec = self.text_embedder.embed_query(chunk["content"])
            chunk[self.text_vector_field] = vec
            chunk[f"{self.text_vector_field}_dim"] = len(vec)
        except Exception as e:
            chunk = self._handle_embedding_error(chunk, e)

        return chunk

    def _embed_image_chunks_batched(self, image_chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Embed image chunks in batches for optimal performance."""
        if not image_chunks:
            return []

        chunks = [dict(chunk) for chunk in image_chunks]  # Create copies
        image_objs = []
        valid_indices = []

        # Collect valid image objects
        for i, chunk in enumerate(chunks):
            img_obj = chunk.get("_image_obj") or chunk.get("content", "")
            if img_obj:
                image_objs.append(img_obj)
                valid_indices.append(i)

        if not image_objs:
            # Fallback to text embedding for all image chunks
            return [self._fallback_image_to_text(chunk) for chunk in chunks]

        # Batch process images
        try:
            # Primary batch processing
            vecs = self.image_embedder.encode(
                image_objs,
                convert_to_numpy=True,
                show_progress_bar=False,
                batch_size=min(len(image_objs), 32)  # Adjust batch size as needed
            )
        except Exception:
            # Fallback: encode images one by one
            vecs = []
            for img in image_objs:
                try:
                    v = self.image_embedder.encode(img, convert_to_numpy=True)
                    vecs.append(v)
                except Exception:
                    # Fallback to zero vector or text embedding
                    vecs.append(None)
            vecs = np.stack(vecs, axis=0)

        # Assign vectors to chunks
        for idx, v in zip(valid_indices, vecs):
            if v is not None:
                chunks[idx][self.image_vector_field] = v.tolist()
                chunks[idx][f"{self.image_vector_field}_dim"] = int(v.shape[0])
            else:
                # Fallback to text embedding for this specific image
                chunks[idx] = self._fallback_image_to_text(chunks[idx])

        # Handle chunks without valid image objects
        for i, chunk in enumerate(chunks):
            if self.text_vector_field not in chunk:
                chunks[i] = self._fallback_image_to_text(chunk)

        return chunks

    def _fallback_image_to_text(self, chunk: Dict[str, Any]) -> Dict[str, Any]:
        """Fallback to text embedding when image processing fails."""
        chunk = dict(chunk)
        try:
            fallback_embedding = self.text_embedder.embed_query(chunk.get("content", ""))
            chunk[self.text_vector_field] = fallback_embedding
            chunk[f"{self.text_vector_field}_dim"] = len(fallback_embedding)
        except Exception as e:
            chunk = self._handle_embedding_error(chunk, e)
        return chunk

    def _handle_embedding_error(self, chunk: Dict[str, Any], error: Exception) -> Dict[str, Any]:
        """Handle embedding errors by providing fallback embeddings."""
        import numpy as np
        try:
            fallback_embedding = self.text_embedder.embed_query(chunk.get("content", ""))
            chunk[self.text_vector_field] = fallback_embedding
            chunk[f"{self.text_vector_field}_dim"] = len(fallback_embedding)
        except Exception:
            # Ultimate fallback - zero vector
            dim = 768  # Default dimension for nomic
            chunk[self.text_vector_field] = np.random.normal(0, 0.01, dim).tolist()
            chunk[f"{self.text_vector_field}_dim"] = dim

        chunk["embed_error"] = str(error)
        return chunk

# Example usage
if __name__ == "__main__":
    ingestor = DocumentIngestor(upload_folder="./uploads")

    # Test with sample files
    sample_image_path = "sample.jpg"
    sample_pdf_path = "sample.pdf"
    sample_audio_path = "../uploads/sample/sample.wav"

    # Create minimal metadata
    meta_image = {
        "file_id": str(uuid.uuid4()),
        "upload_timestamp": datetime.now().strftime(ingestor.ts_format),
        "file_extension": sample_image_path.split(".")[-1].lower()
    }

    # Process file
    if os.path.exists(sample_audio_path):
        chunks = ingestor.ingest_file(sample_audio_path, meta_image)
        chunks_with_vectors = ingestor.embed_chunks(chunks)

        for c in chunks_with_vectors:
            metadata = c['metadata']
            print(f"Chunk {metadata.get('chunk_id', 'N/A')}: {c['content'][:50]}... "
                  f"Time: {metadata.get('start_time', 'N/A')}s - {metadata.get('end_time', 'N/A')}s "
                  f"Embedding dim: {c.get('embedding_dim', 'N/A')}")
