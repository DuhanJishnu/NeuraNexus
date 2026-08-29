import time
import json
from flask import Blueprint, request, jsonify, Response
from models.retriever import Retriever
from models.llm_grounding import LLMGrounding
from models.embedding_service import EmbeddingService
from models.vector_store import VectorDB

chat_bp = Blueprint('chat', __name__)


def _sse_event(event_type, data):
    """Serialize a Server-Sent Event using syntax supported by Python 3.11."""
    return f"data: {json.dumps({'type': event_type, 'data': data})}\n\n"

# Initialize components
embedding_service = EmbeddingService()
vector_db = VectorDB()

# Standard and enhanced components
retriever = Retriever(vector_db, embedding_service)
llm_grounding = LLMGrounding()

@chat_bp.route('/api/chat', methods=['POST'])
def chat():
    """Main chat endpoint with selectable RAG pipeline"""
    try:
        data = request.get_json()
        
        if not data or 'question' not in data:
            return jsonify({"success": False, "error": "Question is required"}), 400
        
        question = data['question'].strip()
        
        if not question:
            return jsonify({"success": False, "error": "Question cannot be empty"}), 400
        
        # Use the standard pipeline
        retrieved_docs = retriever.retrieve(question)
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
        
        if not question:
            return jsonify({"success": False, "error": "Question cannot be empty"}), 400

        def generate():
            try:
                retrieved_docs = retriever.retrieve(question)
                yield _sse_event('retrieval_info', {
                    'documents_retrieved': len(retrieved_docs)
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
                if hasattr(llm_grounding, 'generate_response_stream'):
                    stream_generator = llm_grounding.generate_response_stream(question, retrieved_docs)
                    answer_chunks = []
                    for chunk in stream_generator:
                        answer_chunks.append(chunk)
                        yield _sse_event('answer_chunk', chunk)
                    response['citations'] = llm_grounding.citations_for_response(
                        ''.join(answer_chunks), retrieved_docs
                    )
                else:
                    response = llm_grounding.generate_response(question, retrieved_docs)
                    answer = response.get("answer", "")
                    words = answer.split()
                    for i, word in enumerate(words):
                        yield _sse_event(
                            'answer_chunk',
                            word + (' ' if i < len(words) - 1 else '')
                        )
                        time.sleep(0.03)
                
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
