"""Benchmark module: generates graphs, times the four algorithms honestly."""

from __future__ import annotations

import time
import tracemalloc
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..algorithms.bellman_ford import bellman_ford
from ..algorithms.bfs import bfs
from ..algorithms.dfs import dfs
from ..algorithms.dijkstra import dijkstra
from ..analysis.generators import generate_graph
from ..database.db import get_db
from ..models.models import BenchmarkResult
from ..schemas.schemas import BenchmarkRequest, BenchmarkResponse

router = APIRouter(prefix="/api/benchmark", tags=["benchmark"])

MAX_EDGES = 120_000
BELLMAN_FORD_LIMIT = 1500  # above this O(V*E) becomes impractically slow for a live demo


def _iterations_for(size: int, requested: int | None) -> int:
    if requested:
        return requested
    if size <= 100:
        return 5
    if size <= 500:
        return 3
    return 1


def _measure_memory_kb(func) -> float:
    """Peak allocation of one isolated run.

    tracemalloc slows allocation-heavy code down, so it is measured in a
    separate run and never while the execution timer is running.
    """
    tracemalloc.start()
    try:
        func()
        _, peak = tracemalloc.get_traced_memory()
    finally:
        tracemalloc.stop()
    return peak / 1024


@router.post("/run", response_model=BenchmarkResponse)
def run_benchmark(payload: BenchmarkRequest, db: Session = Depends(get_db)):
    run_id = uuid.uuid4().hex[:12]
    rows: List[Dict[str, Any]] = []
    generated_at = datetime.now(timezone.utc)
    note = (
        "Graph generation time is measured separately and excluded from all algorithm timings. "
        "Runs disable the step-by-step trace that powers the visualiser, so each number reflects "
        "the algorithm itself rather than trace bookkeeping. "
        "Small numbers (<1 ms) are approximate because timer resolution varies by machine."
    )

    for size in payload.sizes:
        density = payload.density
        # Cap the edge count so a dense 5000-node request stays runnable.
        max_pairs = size * (size - 1) / (1 if payload.directed else 2)
        effective_density = min(density, MAX_EDGES / max_pairs) if max_pairs > 0 else density

        gen_start = time.perf_counter()
        try:
            graph = generate_graph(
                node_count=size,
                density=max(effective_density, 1e-6),
                directed=payload.directed,
                weighted=True,
                connected=payload.connected,
                seed=42,
            )
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        generation_ms = (time.perf_counter() - gen_start) * 1000

        nodes = graph.get_nodes()
        start_node = nodes[0]
        destination = nodes[-1] if len(nodes) > 1 else None
        iterations = _iterations_for(size, payload.iterations)

        for algorithm in payload.algorithms:
            if algorithm == "Bellman-Ford" and size > BELLMAN_FORD_LIMIT:
                rows.append(
                    _row(
                        run_id, algorithm, graph, payload, 0, 0, 0, 0, 0, 0,
                        f"Skipped: Bellman-Ford is O(V*E); {size} nodes would be too slow for an interactive run "
                        f"(limit {BELLMAN_FORD_LIMIT} nodes).",
                    )
                )
                continue

            if algorithm == "BFS":
                call = lambda: bfs(graph, start_node, trace=False)
            elif algorithm == "DFS":
                call = lambda: dfs(graph, start_node, "recursive", trace=False)
            elif algorithm == "Dijkstra":
                call = lambda: dijkstra(graph, start_node, destination, trace=False)
            else:
                call = lambda: bellman_ford(graph, start_node, destination, trace=False)

            # Warm-up run (excluded), then measured runs.
            try:
                call()
            except Exception:  # noqa: BLE001 - warm-up only
                pass

            timings: List[float] = []
            visited = edge_ops = 0
            for _ in range(iterations):
                t0 = time.perf_counter()
                result = call()
                timings.append((time.perf_counter() - t0) * 1000)
                visited = len(result.get("visited", result.get("order", [])))
                edge_ops = result.get("edge_operations") or result.get("relaxations") or 0

            memory_kb = _measure_memory_kb(call) if size <= 1000 else 0.0

            rows.append(
                _row(
                    run_id,
                    algorithm,
                    graph,
                    payload,
                    sum(timings) / len(timings),
                    min(timings),
                    max(timings),
                    iterations,
                    visited,
                    edge_ops,
                    memory_kb,
                    "",
                    generation_ms=generation_ms,
                )
            )

    for row in rows:
        db.add(
            BenchmarkResult(
                run_id=row["run_id"],
                algorithm=row["algorithm"],
                node_count=row["node_count"],
                edge_count=row["edge_count"],
                graph_type=row["graph_type"],
                directed=row["directed"],
                iterations=row["iterations"],
                avg_time_ms=row["avg_time_ms"],
                min_time_ms=row["min_time_ms"],
                max_time_ms=row["max_time_ms"],
                visited_nodes=row["visited_nodes"],
                edge_operations=row["edge_operations"],
                memory_kb=row["memory_kb"],
                skipped_reason=row["skipped_reason"],
            )
        )
    db.commit()

    return {
        "run_id": run_id,
        "generated_at": generated_at,
        "density": payload.density,
        "directed": payload.directed,
        "connected": payload.connected,
        "generation_note": note,
        "rows": rows,
    }


def _row(
    run_id: str,
    algorithm: str,
    graph,
    payload: BenchmarkRequest,
    avg: float,
    minimum: float,
    maximum: float,
    iterations: int,
    visited: int,
    edge_ops: int,
    memory_kb: float,
    skipped: str,
    generation_ms: float = 0.0,
) -> Dict[str, Any]:
    return {
        "run_id": run_id,
        "algorithm": algorithm,
        "node_count": graph.node_count(),
        "edge_count": graph.edge_count(),
        "graph_type": "connected" if payload.connected else "disconnected",
        "directed": payload.directed,
        "iterations": iterations,
        "avg_time_ms": round(avg, 4),
        "min_time_ms": round(minimum, 4),
        "max_time_ms": round(maximum, 4),
        "visited_nodes": visited,
        "edge_operations": edge_ops,
        "memory_kb": round(memory_kb, 2),
        "skipped_reason": skipped,
        "graph_generation_ms": round(generation_ms, 2),
    }


@router.get("/results")
def benchmark_results(limit: int = Query(default=400, ge=1, le=2000), db: Session = Depends(get_db)):
    rows = (
        db.execute(select(BenchmarkResult).order_by(BenchmarkResult.id.desc()).limit(limit))
        .scalars()
        .all()
    )
    return [
        {
            "id": row.id,
            "run_id": row.run_id,
            "algorithm": row.algorithm,
            "node_count": row.node_count,
            "edge_count": row.edge_count,
            "graph_type": row.graph_type,
            "directed": row.directed,
            "iterations": row.iterations,
            "avg_time_ms": row.avg_time_ms,
            "min_time_ms": row.min_time_ms,
            "max_time_ms": row.max_time_ms,
            "visited_nodes": row.visited_nodes,
            "edge_operations": row.edge_operations,
            "memory_kb": row.memory_kb,
            "skipped_reason": row.skipped_reason,
            "created_at": row.created_at,
        }
        for row in rows
    ]


@router.delete("/results", status_code=204)
def clear_benchmark_results(db: Session = Depends(get_db)):
    for row in db.execute(select(BenchmarkResult)).scalars().all():
        db.delete(row)
    db.commit()
    return None
