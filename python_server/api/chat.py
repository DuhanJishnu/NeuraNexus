import time
import json
import re
import threading
from flask import Blueprint, request, jsonify, Response
from models.retriever import Retriever
from models.enhanced_retriever import EnhancedRetriever
from models.llm_grounding import LLMGrounding
from models.safe_llm_grounding import SafeLLMGrounding
from models.embedding_service import EmbeddingService
from models.vector_store import VectorDB
from models.reranker import CrossEncoderReranker
from utils.sanitizer import sanitize_model_output
from utils.retrieval_scope import build_document_filter
from config import Config

chat_bp = Blueprint('chat', __name__)


def _sse_event(event_type, data):
    """Serialize a Server-Sent Event without relying on multiline f-string expressions."""
    return f"data: {json.dumps({'type': event_type, 'data': data})}\n\n"


def _retrieval_summary(documents, selected_vector_db):
    methods = sorted({doc.get('retrieval_method', 'dense') for doc in documents})
    return {
        'documents_retrieved': len(documents),
        'retrieval_methods': methods,
        'hybrid_enabled': selected_vector_db.hybrid_enabled,
        'index_version': selected_vector_db.index_version,
        'latency_ms': documents[0].get('retrieval_latency_ms') if documents else None,
    }


# Initialize components
embedding_service = EmbeddingService()
reranker = CrossEncoderReranker()

# Standard and enhanced components
llm_grounding = LLMGrounding()
safe_llm = SafeLLMGrounding()
pipeline_lock = threading.Lock()
pipeline_cache = {}


def _pipeline_for(data):
    index_version = data.get('index_version', Config.INDEX_VERSION)
    if (
        not isinstance(index_version, str)
        or not re.fullmatch(r'[A-Za-z0-9_.-]{1,100}', index_version)
    ):
        raise ValueError('Invalid index_version')
    with pipeline_lock:
        pipeline = pipeline_cache.get(index_version)
        if pipeline is None:
            selected_vector_db = VectorDB(index_version=index_version)
            pipeline = (
                selected_vector_db,
                Retriever(
                    selected_vector_db, embedding_service, reranker=reranker
                ),
                EnhancedRetriever(
                    selected_vector_db, embedding_service, reranker=reranker
                ),
            )
            pipeline_cache[index_version] = pipeline
        return pipeline

@chat_bp.route('/api/chat', methods=['POST'])
def chat():
    """Main chat endpoint with selectable RAG pipeline"""
    try:
        data = request.get_json()
        
        if not data or 'question' not in data:
            return jsonify({"success": False, "error": "Question is required"}), 400
        
        question = data['question'].strip()
        vector_db, retriever, enhanced_retriever = _pipeline_for(data)
        secure_mode = data.get('secure_mode', False)
        stream = data.get('stream', False)  # Add stream option for regular chat endpoint
        metadata_filter = build_document_filter(data)
        
        if not question:
            return jsonify({"success": False, "error": "Question cannot be empty"}), 400
        
        # If streaming is requested, redirect to stream endpoint
        if stream:
            return chat_stream()
        
        if secure_mode:
            # Use the secure pipeline
            retrieval_result = enhanced_retriever.retrieve_with_confidence(
                question, metadata_filter=metadata_filter
            )
            response = safe_llm.generate_safe_response(
                question,
                retrieval_result["documents"],
                retrieval_result["confidence_metrics"]
            )
            response.update({
                "success": True,
                "question": question,
                "retrieval_metrics": retrieval_result["confidence_metrics"],
                "documents_retrieved": len(retrieval_result["documents"]),
                "should_proceed": retrieval_result["should_proceed"]
            })
            return jsonify(response)
        else:
            # Use the standard pipeline
            retrieved_docs = retriever.retrieve(
                question, metadata_filter=metadata_filter
            )
            if not retrieved_docs:
                return jsonify({
                    "success": True,
                    "answer": "I couldn't find relevant information in the documents to answer your question.",
                    "citations": [],
                    "retrieved_documents": []
                })
            response = llm_grounding.generate_response(question, retrieved_docs)
            return jsonify({
                "success": True,
                "question": question,
                "retrieval": _retrieval_summary(retrieved_docs, vector_db),
                **response
            })
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@chat_bp.route('/api/chat/stream', methods=['POST'])
def chat_stream():
    """Chat endpoint with SSE for streaming responses."""
    try:
        data = request.get_json()
        
        if not data or 'question' not in data:
            return jsonify({"success": False, "error": "Question is required"}), 400
        
        question = data['question'].strip()
        vector_db, retriever, enhanced_retriever = _pipeline_for(data)
        secure_mode = data.get('secure_mode', False)
        metadata_filter = build_document_filter(data)
        
        if not question:
            return jsonify({"success": False, "error": "Question cannot be empty"}), 400

        def generate():
            try:
                if secure_mode:
                    # Enhanced retrieval with confidence
                    retrieval_result = enhanced_retriever.retrieve_with_confidence(
                        question, metadata_filter=metadata_filter
                    )
                    
                    # Send retrieval metrics first
                    yield _sse_event('retrieval_metrics', {
                        'metrics': retrieval_result['confidence_metrics'],
                        'documents_retrieved': len(retrieval_result['documents']),
                        'should_proceed': retrieval_result['should_proceed']
                    })
                    
                    if not retrieval_result["should_proceed"]:
                        # Send final message if we shouldn't proceed
                        yield _sse_event('final', {
                            'success': True,
                            'question': question,
                            'answer': retrieval_result.get('proceed_message', 'Unable to provide a confident response.'),
                            'citations': [],
                            'retrieved_documents': []
                        })
                        return
                    
                    response = {"citations": []}
                    # Generate safe response (assuming safe_llm supports streaming)
                    if hasattr(safe_llm, 'generate_safe_response_stream'):
                        # If the safe LLM supports streaming
                        stream_generator = safe_llm.generate_safe_response_stream(
                            question,
                            retrieval_result["documents"],
                            retrieval_result["confidence_metrics"]
                        )
                        answer_chunks = []
                        for chunk in stream_generator:
                            answer_chunks.append(chunk)
                            yield _sse_event('answer_chunk', chunk)
                        response['citations'] = safe_llm.citations_for_response(
                            ''.join(answer_chunks), retrieval_result["documents"]
                        )
                    else:
                        # Fallback: simulate streaming for safe response
                        response = safe_llm.generate_safe_response(
                            question,
                            retrieval_result["documents"],
                            retrieval_result["confidence_metrics"]
                        )
                        answer = response.get("answer", "")
                        
                        # Stream answer word by word
                        words = answer.split()
                        for i, word in enumerate(words):
                            yield _sse_event(
                                'answer_chunk',
                                word + (' ' if i < len(words) - 1 else '')
                            )
                            time.sleep(0.03)  # Adjust speed as needed
                    
                    # Send final data
                    yield _sse_event('final', {
                        'success': True,
                        'question': question,
                        'citations': response.get('citations', []),
                        'retrieved_documents': retrieval_result['documents'],
                        'retrieval_metrics': retrieval_result['confidence_metrics']
                    })

                else:
                    # Standard pipeline
                    retrieved_docs = retriever.retrieve(
                        question, metadata_filter=metadata_filter
                    )
                    
                    # Send retrieval info
                    yield _sse_event('retrieval_info', {
                        **_retrieval_summary(retrieved_docs, vector_db)
                    })
                    
                    if not retrieved_docs:
                        yield _sse_event('final', {
                            'success': True,
                            'answer': "I couldn't find relevant information in the documents to answer your question.",
                            'citations': [],
                            'retrieved_documents': []
                        })
                        return

                    response = {"citations": []}
                    # Generate streaming response (assuming llm_grounding supports streaming)
                    if hasattr(llm_grounding, 'generate_response_stream'):
                        # If the LLM supports streaming
                        stream_generator = llm_grounding.generate_response_stream(question, retrieved_docs)
                        answer_chunks = []
                        for chunk in stream_generator:
                            answer_chunks.append(chunk)
                            yield _sse_event('answer_chunk', chunk)
                        response['citations'] = llm_grounding.citations_for_response(
                            ''.join(answer_chunks), retrieved_docs
                        )
                    else:
                        # Fallback: simulate streaming
                        response = llm_grounding.generate_response(question, retrieved_docs)
                        answer = response.get("answer", "")
                        answer_with_markers = answer.replace('\n', '___NEWLINE___')
                        words = answer_with_markers.split()
                        for i, word in enumerate(words):
                            chunk = word.replace('___NEWLINE___', '\n')
                            yield _sse_event(
                                'answer_chunk',
                                chunk + (' ' if i < len(words) - 1 else '')
                            )
                            time.sleep(0.03)  # Adjust speed as needed
                    
                    # Send final data with citations
                    yield _sse_event('final', {
                        'success': True,
                        'question': question,
                        'citations': response.get('citations', []),
                        'retrieved_documents': retrieved_docs
                    })

            except Exception as e:
                yield _sse_event('error', {
                    'error': str(e),
                    'success': False
                })

        return Response(
            generate(),
            mimetype='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no'  # Important for nginx
            }
        )

    except Exception as e:
        def error_generate():
            yield _sse_event('error', {
                'success': False,
                'error': str(e)
            })
        return Response(error_generate(), mimetype='text/event-stream')

@chat_bp.route('/api/search', methods=['POST'])
def search():
    """Direct document search with optional query analysis"""
    try:
        data = request.get_json()
        
        if not data or 'query' not in data:
            return jsonify({"success": False, "error": "Query is required"}), 400
        
        query = data['query'].strip()
        vector_db, retriever, enhanced_retriever = _pipeline_for(data)
        k = data.get('k', 5)
        analyze = data.get('analyze', False)
        metadata_filter = build_document_filter(data)

        if not query:
            return jsonify({"success": False, "error": "Query cannot be empty"}), 400
        if not isinstance(k, int) or isinstance(k, bool) or not 1 <= k <= 20:
            return jsonify({"success": False, "error": "k must be an integer from 1 to 20"}), 400

        if analyze:
            # Perform query analysis using the enhanced retriever
            retrieval_result = enhanced_retriever.retrieve_with_confidence(
                query, metadata_filter=metadata_filter
            )
            return jsonify({
                "success": True,
                "query": query,
                "index_version": vector_db.index_version,
                "analysis": retrieval_result["confidence_metrics"],
                "should_proceed": retrieval_result["should_proceed"],
                "message": retrieval_result["proceed_message"],
                "documents_retrieved": len(retrieval_result["documents"])
            })
        else:
            # Perform a standard search
            retrieved_docs = retriever.retrieve(
                query, metadata_filter=metadata_filter
            )
            return jsonify({
                "success": True,
                "query": query,
                "index_version": vector_db.index_version,
                "results": [
                    {
                        "content": doc["content"],
                        "metadata": doc["metadata"],
                        "similarity_score": doc.get("similarity_score", 0),
                        "lexical_score": doc.get("lexical_score", 0),
                        "fusion_score": doc.get("fusion_score", 0),
                        "relevance_score": doc.get("relevance_score", 0),
                        "dense_rank": doc.get("dense_rank"),
                        "sparse_rank": doc.get("sparse_rank"),
                        "retrieval_method": doc.get("retrieval_method", "dense"),
                        "retrieval_latency_ms": doc.get("retrieval_latency_ms"),
                    }
                    for doc in retrieved_docs[:k]
                ]
            })
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
