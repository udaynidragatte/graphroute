"""Alternative simple-path search used by the Route Finder page.

This is a bounded depth-first enumeration of simple paths, NOT a replacement for
Dijkstra/Bellman-Ford: it exists only to show a few alternative routes so the
optimal answer can be contrasted with them.
"""

from __future__ import annotations

from typing import Any, Dict, List

from .graph import Graph

MAX_PATHS = 5
MAX_EXPANSIONS = 60000


def alternative_routes(graph: Graph, source: str, destination: str, limit: int = MAX_PATHS) -> Dict[str, Any]:
    if not graph.has_node(source):
        raise ValueError(f"Source node '{source}' does not exist")
    if not graph.has_node(destination):
        raise ValueError(f"Destination node '{destination}' does not exist")
    if source == destination:
        return {"paths": [], "truncated": False}

    found: List[Dict[str, Any]] = []
    expansions = 0
    truncated = False
    visited = {source}

    def walk(node: str, path: List[str], cost: float) -> None:
        nonlocal expansions, truncated
        if len(found) >= limit:
            return
        if expansions >= MAX_EXPANSIONS:
            truncated = True
            return
        expansions += 1

        if node == destination:
            found.append({"path": list(path), "cost": round(cost, 6), "hops": len(path) - 1})
            return

        for neighbour, weight in sorted(graph.get_neighbors(node).items()):
            if neighbour in visited:
                continue
            visited.add(neighbour)
            path.append(neighbour)
            walk(neighbour, path, cost + weight)
            path.pop()
            visited.remove(neighbour)

    walk(source, [source], 0.0)
    found.sort(key=lambda item: item["cost"])
    return {"paths": found[:limit], "truncated": truncated}
