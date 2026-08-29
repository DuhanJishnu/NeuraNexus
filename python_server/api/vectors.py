import re

from flask import Blueprint, jsonify, request

from models.vector_store import VectorDB
from config import Config


vectors_bp = Blueprint('vectors', __name__)


def _configured_vector_dbs():
    return {
        version: VectorDB(index_version=version)
        for version in VectorDB.configured_versions()
    }


@vectors_bp.route('/api/vectors/documents/<document_id>', methods=['DELETE'])
def delete_document_vectors(document_id: str):
    """Delete every vector whose deterministic ID belongs to a document."""
    if not re.fullmatch(r'[A-Za-z0-9_]+', document_id):
        return jsonify({"success": False, "error": "Invalid document ID"}), 400

    deleted_by_version = {
        version: vector_db.delete_document(document_id)
        for version, vector_db in _configured_vector_dbs().items()
    }
    return jsonify({
        "success": True,
        "documentId": document_id,
        "deletedVectors": sum(deleted_by_version.values()),
        "deletedByVersion": deleted_by_version,
    })


@vectors_bp.route('/api/indexes', methods=['GET'])
def configured_indexes():
    """Expose configured deployment versions without credentials."""
    indexes = _configured_vector_dbs()
    return jsonify({
        "activeDefault": Config.INDEX_VERSION,
        "indexes": [
            {"version": version, "hybrid": vector_db.hybrid_enabled}
            for version, vector_db in indexes.items()
        ],
    })
