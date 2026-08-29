import re
from typing import Any, Dict, Optional


def build_document_filter(data: Dict[str, Any]) -> Optional[str]:
    """Build a deny-by-default visibility and optional document filter."""
    retrieval_scope = data.get("retrieval_scope") or {}
    if not isinstance(retrieval_scope, dict):
        raise ValueError("retrieval_scope must be an object")
    principal_id = retrieval_scope.get("principal_id")
    include_global = retrieval_scope.get("include_global", True)
    if not isinstance(include_global, bool):
        raise ValueError("include_global must be a boolean")
    if principal_id is not None and (
        not isinstance(principal_id, str)
        or not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", principal_id)
    ):
        raise ValueError("retrieval_scope contains an invalid principal_id")

    visibility_clauses = []
    if include_global:
        # Vectors created before visibility metadata was introduced are global
        # because uploads were admin-only at that time.
        visibility_clauses.extend([
            "HAS NOT FIELD visibility",
            "visibility = 'GLOBAL'",
        ])
    if principal_id:
        visibility_clauses.append(
            f"(visibility = 'PRIVATE' AND owner_id = '{principal_id}')"
        )
    if not visibility_clauses:
        raise ValueError("retrieval_scope grants no document visibility")
    visibility_filter = f"({' OR '.join(visibility_clauses)})"

    document_ids = data.get("document_ids") or []
    if not isinstance(document_ids, list) or len(document_ids) > 100:
        raise ValueError("document_ids must be a list of at most 100 IDs")
    if not document_ids:
        return visibility_filter
    for document_id in document_ids:
        if (
            not isinstance(document_id, str)
            or not document_id.replace("_", "").isalnum()
        ):
            raise ValueError("document_ids contains an invalid ID")
    quoted_ids = ", ".join(f"'{document_id}'" for document_id in document_ids)
    return f"{visibility_filter} AND file_id IN ({quoted_ids})"
