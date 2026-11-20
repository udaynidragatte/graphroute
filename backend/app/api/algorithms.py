"""Traversal and shortest-path endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..algorithms.bellman_ford import bellman_ford
from ..algorithms.bfs import bfs
from ..algorithms.dfs import dfs
from ..algorithms.dijkstra import dijkstra
from ..algorithms.graph import GraphError
from ..algorithms.routes import alternative_routes
from ..database.db import get_db
from ..schemas.schemas import RouteRequest, ShortestPathRequest, TraversalRequest
from .deps import build_graph, get_graph_or_404, log_activity

router = APIRouter(prefix="/api/algorithms", tags=["algorithms"])


def _graph(db: Session, graph_id: int):
    model = get_graph_or_404(db, graph_id)
    graph = build_graph(model)
    if not graph.graph_exists():
        raise HTTPException(status_code=422, detail="The graph has no nodes yet")
    return model, graph


@router.post("/bfs")
def run_bfs(payload: TraversalRequest, db: Session = Depends(get_db)):
    model, graph = _graph(db, payload.graph_id)
    try:
        result = bfs(graph, payload.start)
    except (ValueError, GraphError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    log_activity(db, model.id, "bfs", f"BFS executed from '{payload.start}' ({len(result['visited'])} nodes visited)")
    return result


@router.post("/dfs")
def run_dfs(payload: TraversalRequest, db: Session = Depends(get_db)):
    model, graph = _graph(db, payload.graph_id)
    try:
        result = dfs(graph, payload.start, payload.mode)
    except (ValueError, GraphError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    log_activity(db, model.id, "dfs", f"{result['algorithm']} executed from '{payload.start}'")
    return result


@router.post("/dijkstra")
def run_dijkstra(payload: ShortestPathRequest, db: Session = Depends(get_db)):
    model, graph = _graph(db, payload.graph_id)
    try:
        result = dijkstra(graph, payload.source, payload.destination)
    except (ValueError, GraphError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    if payload.destination:
        log_activity(
            db,
            model.id,
            "shortest_path",
            f"Dijkstra route {payload.source} → {payload.destination}: cost {result['distance']}",
        )
    else:
        log_activity(db, model.id, "dijkstra", f"Dijkstra run from '{payload.source}'")
    return result


@router.post("/bellman-ford")
def run_bellman_ford(payload: ShortestPathRequest, db: Session = Depends(get_db)):
    model, graph = _graph(db, payload.graph_id)
    try:
        result = bellman_ford(graph, payload.source, payload.destination)
    except (ValueError, GraphError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    if result["has_negative_cycle"]:
        log_activity(db, model.id, "shortest_path", "Bellman-Ford detected a negative weight cycle")
    elif payload.destination:
        log_activity(
            db,
            model.id,
            "shortest_path",
            f"Bellman-Ford route {payload.source} → {payload.destination}: cost {result['distance']}",
        )
    else:
        log_activity(db, model.id, "bellman_ford", f"Bellman-Ford run from '{payload.source}'")
    return result


@router.post("/route")
def run_route(payload: RouteRequest, db: Session = Depends(get_db)):
    """Route Finder: optimal path plus a few alternative simple paths."""
    model, graph = _graph(db, payload.graph_id)
    if payload.source == payload.destination:
        raise HTTPException(status_code=422, detail="Source and destination must be different nodes")

    try:
        if payload.algorithm == "bellman-ford":
            result = bellman_ford(graph, payload.source, payload.destination)
        else:
            result = dijkstra(graph, payload.source, payload.destination)
    except (ValueError, GraphError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    alternatives = {"paths": [], "truncated": False}
    if payload.include_alternatives:
        alternatives = alternative_routes(graph, payload.source, payload.destination)

    best_path = tuple(result["path"])
    others = [item for item in alternatives["paths"] if tuple(item["path"]) != best_path]

    reachable = result.get("distance") is not None
    log_activity(
        db,
        model.id,
        "shortest_path",
        f"{result['algorithm']} route {payload.source} → {payload.destination}: "
        + (f"cost {result['distance']}" if reachable else "destination unreachable"),
    )

    return {
        "algorithm": result["algorithm"],
        "source": payload.source,
        "destination": payload.destination,
        "reachable": reachable and not result.get("has_negative_cycle", False),
        "distance": result.get("distance"),
        "hops": result.get("hops", 0),
        "path": result.get("path", []),
        "visited": result.get("visited", []),
        "relaxations": result.get("relaxations", 0),
        "has_negative_cycle": result.get("has_negative_cycle", False),
        "negative_cycle": result.get("negative_cycle", []),
        "alternatives": others,
        "alternatives_truncated": alternatives["truncated"],
        "complexity": result["complexity"],
        "distances": result.get("distances", {}),
    }
