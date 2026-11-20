"""Analysis, connectivity, hashing-explorer and activity endpoints."""

from __future__ import annotations

import time
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..analysis.analysis import analyze, connectivity
from ..database.db import get_db
from ..models.models import Activity
from ..schemas.schemas import ActivityOut, ConnectivityRequest
from .deps import build_graph, get_graph_or_404, serialize_node

router = APIRouter(prefix="/api", tags=["analysis"])

HASH_BUCKETS = 8


def _stable_hash(key: str) -> int:
    """djb2 - a deterministic stand-in so the demo shows the same value every run.

    The real adjacency lookup uses Python's built-in dict, whose string hashing is
    randomised per process. This function is only for explaining bucket placement.
    """
    value = 5381
    for char in key:
        value = ((value * 33) + ord(char)) & 0xFFFFFFFF
    return value


@router.get("/graphs/{graph_id}/analysis")
def graph_analysis(graph_id: int, db: Session = Depends(get_db)):
    model = get_graph_or_404(db, graph_id)
    graph = build_graph(model)
    result = analyze(graph)
    result["graph_id"] = model.id
    result["graph_name"] = model.name
    degrees = {node: graph.get_degree(node) for node in graph.get_nodes()}
    result["degrees"] = degrees
    return result


@router.post("/graphs/{graph_id}/connectivity")
def graph_connectivity(graph_id: int, payload: ConnectivityRequest, db: Session = Depends(get_db)):
    model = get_graph_or_404(db, graph_id)
    graph = build_graph(model)
    try:
        return connectivity(graph, payload.source)
    except ValueError as exc:
        from fastapi import HTTPException

        raise HTTPException(status_code=422, detail=str(exc))


@router.get("/graphs/{graph_id}/nodes")
def list_nodes(graph_id: int, db: Session = Depends(get_db)):
    model = get_graph_or_404(db, graph_id)
    return [serialize_node(node) for node in model.nodes]


@router.get("/graphs/{graph_id}/hash-lookup")
def hash_lookup(graph_id: int, q: str = Query(min_length=1, max_length=80), db: Session = Depends(get_db)):
    """Interactive hashing demo: O(1) dict lookup plus bucket illustration."""
    model = get_graph_or_404(db, graph_id)
    graph = build_graph(model)

    start = time.perf_counter()
    found = graph.has_node(q)
    neighbours = graph.get_neighbors(q) if found else {}
    degree = graph.get_degree(q) if found else 0
    metadata = graph.get_metadata(q) if found else {}
    elapsed_us = (time.perf_counter() - start) * 1_000_000

    buckets = {}
    for node in graph.get_nodes():
        buckets.setdefault(_stable_hash(node) % HASH_BUCKETS, []).append(node)

    return {
        "query": q,
        "found": found,
        "directed": graph.directed,
        "lookup_time_us": round(elapsed_us, 3),
        "lookup_type": "Python dict (built-in hash map, average O(1))",
        "node": {"id": q, "label": q, "metadata": metadata} if found else None,
        "neighbors": neighbours,
        "neighbor_count": len(neighbours),
        "degree": degree,
        "incoming": sorted(
            source for source, targets in graph.to_adjacency().items() if q in targets
        )
        if found and graph.directed
        else [],
        "demo_hash": _stable_hash(q),
        "bucket": _stable_hash(q) % HASH_BUCKETS,
        "buckets": [{"index": i, "nodes": buckets.get(i, [])} for i in range(HASH_BUCKETS)],
        "adjacency_table": graph.to_adjacency(),
        "node_count": graph.node_count(),
        "edge_count": graph.edge_count(),
        "complexity": {"average": "O(1)", "worst": "O(n)"},
    }


@router.get("/activities", response_model=list[ActivityOut])
def recent_activities(
    limit: int = Query(default=15, ge=1, le=100),
    graph_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
):
    query = select(Activity).order_by(Activity.id.desc()).limit(limit)
    if graph_id is not None:
        query = select(Activity).where(Activity.graph_id == graph_id).order_by(Activity.id.desc()).limit(limit)
    return db.execute(query).scalars().all()
