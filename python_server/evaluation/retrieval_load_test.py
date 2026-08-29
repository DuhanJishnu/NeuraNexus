#!/usr/bin/env python3
import argparse
import json
import os
import statistics
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any, Dict, List

import requests


def percentile(values: List[float], fraction: float) -> float:
    ordered = sorted(values)
    index = min(round((len(ordered) - 1) * fraction), len(ordered) - 1)
    return ordered[index]


def run_request(base_url: str, token: str, question: str, k: int) -> Dict[str, Any]:
    started = time.perf_counter()
    try:
        response = requests.post(
            f"{base_url.rstrip('/')}/api/search",
            headers={"Authorization": f"Bearer {token}"},
            json={"query": question, "k": k},
            timeout=60,
        )
        return {
            "ok": response.ok,
            "status": response.status_code,
            "latency_ms": (time.perf_counter() - started) * 1_000,
        }
    except requests.RequestException:
        return {
            "ok": False,
            "status": 0,
            "latency_ms": (time.perf_counter() - started) * 1_000,
        }


def load_test(
    questions: List[str],
    base_url: str,
    token: str,
    concurrency: int,
    requests_count: int,
    k: int,
) -> Dict[str, float]:
    if not questions:
        raise ValueError("The dataset must contain at least one question")
    started = time.perf_counter()
    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [
            executor.submit(
                run_request, base_url, token, questions[index % len(questions)], k
            )
            for index in range(requests_count)
        ]
        results = [future.result() for future in as_completed(futures)]
    duration = time.perf_counter() - started
    latencies = [result["latency_ms"] for result in results]
    failures = sum(not result["ok"] for result in results)
    return {
        "requests": float(requests_count),
        "concurrency": float(concurrency),
        "throughput_rps": requests_count / duration,
        "error_rate": failures / requests_count,
        "latency_ms_mean": statistics.fmean(latencies),
        "latency_ms_p50": percentile(latencies, 0.50),
        "latency_ms_p95": percentile(latencies, 0.95),
        "latency_ms_p99": percentile(latencies, 0.99),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Concurrent RAG retrieval load gate")
    parser.add_argument("dataset", type=Path)
    parser.add_argument("--base-url", default="http://localhost:5000")
    parser.add_argument("--concurrency", type=int, default=8)
    parser.add_argument("--requests", type=int, default=100)
    parser.add_argument("--k", type=int, default=5)
    parser.add_argument("--max-error-rate", type=float, default=0.01)
    parser.add_argument("--max-p95-ms", type=float, default=2_000)
    args = parser.parse_args()
    if args.concurrency < 1 or args.requests < 1:
        raise SystemExit("concurrency and requests must be positive")

    token = os.getenv("INGESTION_SERVICE_TOKEN")
    if not token:
        raise SystemExit("INGESTION_SERVICE_TOKEN is required")
    cases = [
        json.loads(line)
        for line in args.dataset.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    report = load_test(
        [case["question"] for case in cases],
        args.base_url,
        token,
        args.concurrency,
        args.requests,
        args.k,
    )
    print(json.dumps(report, indent=2))
    if report["error_rate"] > args.max_error_rate:
        raise SystemExit("Load gate failed: error rate exceeded")
    if report["latency_ms_p95"] > args.max_p95_ms:
        raise SystemExit("Load gate failed: p95 latency exceeded")


if __name__ == "__main__":
    main()
