"""Dijkstra's shortest path with a binary heap (heapq) priority queue.

Time:  O((V + E) log V)
Space: O(V + E)
"""

from __future__ import annotations

import heapq
import math
from typing import Any, Dict, List, Optional

from .graph import Graph

MAX_TRACE_STEPS = 2000


def dijkstra(
    graph: Graph,
    source: str,
    destination: Optional[str] = None,
    trace: bool = True,
) -> Dict[str, Any]:
    """Dijkstra. ``trace`` records each settle/relax step for the visualiser.

    Building those per-step snapshots of every distance is far more expensive
    than the search itself, so callers that only need the result (benchmarks)
    pass ``trace=False``.
    """
    if not graph.has_node(source):
        raise ValueError(f"Source node '{source}' does not exist")
    if destination is not None and not graph.has_node(destination):
        raise ValueError(f"Destination node '{destination}' does not exist")
    for u, v, w in graph.get_edges():
        if w < 0:
            raise ValueError("Dijkstra's algorithm requires non-negative edge weights")

    dist: Dict[str, float] = {node: math.inf for node in graph.get_nodes()}
    prev: Dict[str, Optional[str]] = {node: None for node in graph.get_nodes()}
    dist[source] = 0.0

    heap: List[tuple[float, str]] = [(0.0, source)]
    visited: List[str] = []
    settled = set()
    trace_enabled = trace
    trace: List[Dict[str, Any]] = []
    relaxations = 0
    comparisons = 0

    while heap:
        current_dist, current = heapq.heappop(heap)
        comparisons += 1
        if current in settled:
            continue
        if current_dist > dist[current]:
            continue  # stale heap entry
        settled.add(current)
        visited.append(current)

        if trace_enabled and len(trace) < MAX_TRACE_STEPS:
            trace.append(
                {
                    "type": "extract",
                    "node": current,
                    "distance": _num(current_dist),
                    "distances": {n: _num(d) for n, d in dist.items()},
                    "visited": list(visited),
                }
            )

        if destination is not None and current == destination:
            break

        for neighbour, weight in sorted(graph.get_neighbors(current).items()):
            relaxations += 1
            candidate = current_dist + weight
            accepted = candidate < dist[neighbour]
            if accepted:
                dist[neighbour] = candidate
                prev[neighbour] = current
                heapq.heappush(heap, (candidate, neighbour))
            if trace_enabled and len(trace) < MAX_TRACE_STEPS:
                trace.append(
                    {
                        "type": "relax",
                        "from": current,
                        "to": neighbour,
                        "edge_weight": _num(weight),
                        "previous_distance": _num(dist[neighbour]) if accepted else _num(candidate),
                        "candidate": _num(candidate),
                        "accepted": accepted,
                        "distances": {n: _num(d) for n, d in dist.items()},
                        "visited": list(visited),
                    }
                )

    path: List[str] = []
    distance: Optional[float] = None
    if destination is not None:
        if dist.get(destination, math.inf) != math.inf:
            distance = dist[destination]
            node: Optional[str] = destination
            while node is not None:
                path.append(node)
                node = prev[node]
            path.reverse()
    else:
        # No destination: report the farthest reachable node for convenience.
        reachable = {n: d for n, d in dist.items() if d != math.inf}
        if reachable:
            farthest = max(reachable, key=reachable.get)
            distance = reachable[farthest]
            node = farthest
            while node is not None:
                path.append(node)
                node = prev[node]
            path.reverse()

    return {
        "algorithm": "Dijkstra",
        "source": source,
        "destination": destination,
        "distance": _num(distance) if distance is not None else None,
        "path": path,
        "hops": max(0, len(path) - 1),
        "distances": {node: _num(d) for node, d in dist.items()},
        "previous": prev,
        "visited": visited,
        "relaxations": relaxations,
        "heap_pops": comparisons,
        "trace": trace,
        "trace_truncated": len(trace) >= MAX_TRACE_STEPS,
        "complexity": {"time": "O((V + E) log V)", "space": "O(V + E)"},
    }


def _num(value: float | None) -> float | None:
    if value is None:
        return None
    if value == math.inf:
        return None
    return round(float(value), 10)
