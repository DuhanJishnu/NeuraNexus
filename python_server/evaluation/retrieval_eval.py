#!/usr/bin/env python3
import argparse
import json
import os
import statistics
import time
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional

from evaluation.metrics import evaluate_rankings


def _percentile(values: List[float], percentile: float) -> float:
    ordered = sorted(values)
    index = min(round((len(ordered) - 1) * percentile), len(ordered) - 1)
    return ordered[index]


def _post_json(url: str, token: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def run(
    dataset: Path,
    base_url: str,
    token: str,
    k: int,
    index_version: Optional[str] = None,
) -> Dict[str, Any]:
    cases = [
        json.loads(line)
        for line in dataset.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    evaluated = []
    latencies = []
    methods = set()
    errors = []
    for case in cases:
        payload = {"query": case["question"], "k": k}
        if case.get("document_ids"):
            payload["document_ids"] = case["document_ids"]
        if index_version:
            payload["index_version"] = index_version
        started = time.perf_counter()
        results = []
        try:
            body = _post_json(
                f"{base_url.rstrip('/')}/api/search",
                token,
                payload,
            )
            results = body.get("results", [])
        except (OSError, ValueError) as error:
            errors.append({
                "question": case["question"],
                "error": str(error)[:500],
            })
        finally:
            latencies.append((time.perf_counter() - started) * 1_000)
        methods.update(result.get("retrieval_method", "unknown") for result in results)
        evaluated.append({
            "relevant_document_ids": case["relevant_document_ids"],
            "predicted_document_ids": [
                result.get("metadata", {}).get("file_id") for result in results
            ],
        })

    report = evaluate_rankings(evaluated, k=k)
    report.update({
        "index_version": index_version or "server-default",
        "error_rate": len(errors) / len(cases),
        "errors": errors,
        "latency_ms_mean": statistics.fmean(latencies),
        "latency_ms_p50": _percentile(latencies, 0.50),
        "latency_ms_p95": _percentile(latencies, 0.95),
        "retrieval_methods": sorted(methods),
    })
    report["promotion_metrics"] = {
        "hitRate": report[f"hit_rate@{k}"],
        "mrr": report[f"mrr@{k}"],
        "errorRate": report["error_rate"],
        "p95LatencyMs": report["latency_ms_p95"],
        "queryCount": int(report["query_count"]),
    }
    return report


def compare(candidate: Dict[str, Any], baseline: Dict[str, Any], k: int) -> Dict[str, float]:
    """Return candidate-minus-baseline deltas; lower latency/error deltas are better."""
    return {
        f"hit_rate@{k}": candidate[f"hit_rate@{k}"] - baseline[f"hit_rate@{k}"],
        f"mrr@{k}": candidate[f"mrr@{k}"] - baseline[f"mrr@{k}"],
        f"recall@{k}": candidate[f"recall@{k}"] - baseline[f"recall@{k}"],
        f"ndcg@{k}": candidate[f"ndcg@{k}"] - baseline[f"ndcg@{k}"],
        "error_rate": candidate["error_rate"] - baseline["error_rate"],
        "latency_ms_p95": candidate["latency_ms_p95"] - baseline["latency_ms_p95"],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate live NeuraNexus retrieval")
    parser.add_argument("dataset", type=Path, help="JSONL file with labeled questions")
    parser.add_argument("--base-url", default="http://localhost:5000")
    parser.add_argument("--k", type=int, default=5)
    parser.add_argument("--index-version", help="Candidate index version to evaluate")
    parser.add_argument(
        "--baseline-version",
        help="Optional active index version to evaluate against the same dataset",
    )
    args = parser.parse_args()
    token = os.getenv("INGESTION_SERVICE_TOKEN")
    if not token:
        raise SystemExit("INGESTION_SERVICE_TOKEN is required")
    candidate = run(
        args.dataset, args.base_url, token, args.k, args.index_version
    )
    if args.baseline_version:
        baseline = run(
            args.dataset, args.base_url, token, args.k, args.baseline_version
        )
        output = {
            "candidate": candidate,
            "baseline": baseline,
            "candidate_minus_baseline": compare(candidate, baseline, args.k),
            "promotion_metrics": {
                **candidate["promotion_metrics"],
                "baselineHitRate": baseline[f"hit_rate@{args.k}"],
                "baselineMrr": baseline[f"mrr@{args.k}"],
                "baselineErrorRate": baseline["error_rate"],
                "baselineP95LatencyMs": baseline["latency_ms_p95"],
                "baselineQueryCount": int(baseline["query_count"]),
            },
        }
    else:
        output = candidate
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
