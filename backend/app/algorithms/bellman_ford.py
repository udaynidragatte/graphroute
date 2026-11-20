"""Bellman-Ford shortest paths, supports negative weights and detects negative cycles.

Time:  O(V * E)
Space: O(V)
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional

from .graph import Graph

MAX_TRACE_STEPS = 2000


def bellman_ford(
    graph: Graph,
    source: str,
    destination: Optional[str] = None,
    trace: bool = True,
) -> Dict[str, Any]:
    """Bellman-Ford. ``trace`` records relaxations for the visualiser."""
    if not graph.has_node(source):
        raise ValueError(f"Source node '{source}' does not exist")
    if destination is not None and not graph.has_node(destination):
        raise ValueError(f"Destination node '{destination}' does not exist")

    nodes = graph.get_nodes()
    edges = graph.get_edges()
    dist: Dict[str, float] = {node: math.inf for node in nodes}
    prev: Dict[str, Optional[str]] = {node: None for node in nodes}
    dist[source] = 0.0

    trace_enabled = trace
    trace: List[Dict[str, Any]] = []
    relaxations = 0
    changed_in_pass = False
    completed_passes = 0

    for iteration in range(1, max(1, len(nodes))):
        changed_in_pass = False
        completed_passes = iteration
        for u, v, w in _directed_edges(graph, edges):
            relaxations += 1
            if dist[u] == math.inf:
                continue
            candidate = dist[u] + w
            if candidate < dist[v] - 1e-12:
                dist[v] = candidate
                prev[v] = u
                changed_in_pass = True
                if trace_enabled and len(trace) < MAX_TRACE_STEPS:
                    trace.append(
                        {
                            "iteration": iteration,
                            "from": u,
                            "to": v,
                            "edge_weight": w,
                            "candidate": round(candidate, 10),
                            "accepted": True,
                            "distances": {n: _num(d) for n, d in dist.items()},
                        }
                    )
        if not changed_in_pass:
            break  # early exit: no relaxation possible any more

    # Negative cycle detection: one more full pass.
    negative_cycle: List[str] = []
    for u, v, w in _directed_edges(graph, edges):
        if dist[u] != math.inf and dist[u] + w < dist[v] - 1e-12:
            # Walk back V times to land inside the cycle, then collect it.
            node = v
            for _ in range(len(nodes)):
                node = prev[node] if prev[node] is not None else node
            cycle = [node]
            current = prev[node]
            while current is not None and current != node and len(cycle) < len(nodes) + 1:
                cycle.append(current)
                current = prev[current]
            cycle.append(node)
            cycle.reverse()
            negative_cycle = cycle
            break

    path: List[str] = []
    distance: Optional[float] = None
    reachable = not negative_cycle
    if destination is not None and reachable:
        if dist.get(destination, math.inf) != math.inf:
            distance = dist[destination]
            node: Optional[str] = destination
            while node is not None:
                path.append(node)
                node = prev[node]
            path.reverse()
    elif destination is None and reachable:
        finite = {n: d for n, d in dist.items() if d != math.inf}
        if finite:
            farthest = max(finite, key=finite.get)
            distance = finite[farthest]
            node = farthest
            while node is not None:
                path.append(node)
                node = prev[node]
            path.reverse()

    return {
        "algorithm": "Bellman-Ford",
        "source": source,
        "destination": destination,
        "distance": _num(distance) if distance is not None else None,
        "path": path,
        "hops": max(0, len(path) - 1),
        "distances": {node: _num(d) for node, d in dist.items()},
        "previous": prev,
        "relaxations": relaxations,
        "iterations": completed_passes,
        "converged_early": not changed_in_pass,
        "negative_cycle": negative_cycle,
        "has_negative_cycle": bool(negative_cycle),
        "trace": trace,
        "trace_truncated": len(trace) >= MAX_TRACE_STEPS,
        "complexity": {"time": "O(V * E)", "space": "O(V)"},
    }


def _directed_edges(graph: Graph, edges):
    """For an undirected graph every stored edge is relaxed in both directions."""
    if graph.directed:
        return edges
    both = []
    for u, v, w in edges:
        both.append((u, v, w))
        both.append((v, u, w))
    return both


def _num(value: float | None) -> float | None:
    if value is None or value == math.inf:
        return None
    return round(float(value), 10)
