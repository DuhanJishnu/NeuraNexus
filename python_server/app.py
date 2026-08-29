import hmac
import re
import uuid
from flask import Flask, Response, jsonify, request
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from config import Config
from utils.metrics import retrieval_metrics
from utils.request_context import request_id_var

# Import blueprints
from api.chat import chat_bp
from api.vectors import vectors_bp

def create_app():
    if not Config.SERVICE_TOKEN:
        raise RuntimeError("INGESTION_SERVICE_TOKEN is required")
    if not Config.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is required")

    app = Flask(__name__)
    app.config.from_object(Config)

    # Initialize extensions
    CORS(app, origins=Config.CORS_ORIGINS)
    limiter = Limiter(
        get_remote_address,
        app=app,
        default_limits=[Config.RATE_LIMIT]
    )
    
    # Register blueprints
    app.register_blueprint(chat_bp)
    app.register_blueprint(vectors_bp)

    @app.before_request
    def require_service_authentication():
        supplied_request_id = request.headers.get('X-Request-Id', '')
        request_id_var.set(
            supplied_request_id
            if re.fullmatch(r'[A-Za-z0-9_-]{8,128}', supplied_request_id)
            else str(uuid.uuid4())
        )
        if request.path == '/api/health':
            return None

        authorization = request.headers.get('Authorization', '')
        scheme, _, supplied_token = authorization.partition(' ')
        if (
            scheme.lower() != 'bearer'
            or not supplied_token
            or not hmac.compare_digest(supplied_token, Config.SERVICE_TOKEN)
        ):
            return jsonify({"success": False, "error": "Unauthorized"}), 401
        return None

    @app.after_request
    def attach_request_id(response):
        response.headers['X-Request-Id'] = request_id_var.get()
        return response
    
    # Health check endpoint
    @app.route('/api/health')
    def health_check():
        return {"status": "healthy", "message": "RAG Pipeline Server is running"}

    @app.route('/api/metrics')
    def metrics():
        return Response(
            retrieval_metrics.render(),
            mimetype='text/plain; version=0.0.4',
        )
    
    return app

app = create_app()
