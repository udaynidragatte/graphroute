"""Breadth First Search implemented by hand with a FIFO queue (collections.deque).

Time:  O(V + E)
Space: O(V)
"""

from __future__ import annotations

from collections import deque
from typing import Any, Dict, List

from .graph import Graph


def bfs(graph: Graph, start: str, trace: bool = True) -> Dict[str, Any]:
    """BFS from ``start``.

    ``trace`` records the queue operations used by the visualiser. Benchmarks
    switch it off so they measure the algorithm instead of the tracing.
    """
    if not graph.has_node(start):
        raise ValueError(f"Start node '{start}' does not exist")

    visited = {start}
    order: List[str] = []
    parent: Dict[str, str | None] = {start: None}
    level: Dict[str, int] = {start: 0}
    queue_ops: List[Dict[str, Any]] = []
    tree_edges: List[List[str]] = []

    _log = queue_ops.append if trace else (lambda _entry: None)

    queue: deque[str] = deque([start])
    _log({"action": "enqueue", "node": start, "queue": list(queue)})

    while queue:
        current = queue.popleft()
        order.append(current)
        _log({"action": "dequeue", "node": current, "queue": list(queue)})

        for neighbour in sorted(graph.get_neighbors(current)):
            if neighbour in visited:
                _log(
                    {"action": "skip", "node": neighbour, "from": current, "reason": "already visited", "queue": list(queue)}
                )
                continue
            visited.add(neighbour)
            parent[neighbour] = current
            level[neighbour] = level[current] + 1
            tree_edges.append([current, neighbour])
            queue.append(neighbour)
            _log({"action": "enqueue", "node": neighbour, "from": current, "queue": list(queue)})

    reachable = list(order)
    unreachable = [node for node in graph.get_nodes() if node not in visited]

    return {
        "algorithm": "BFS",
        "start": start,
        "order": order,
        "visited": reachable,
        "unreachable": unreachable,
        "parent": parent,
        "levels": level,
        "tree_edges": tree_edges,
        "queue_ops": queue_ops,
        "edge_operations": sum(len(graph.get_neighbors(n)) for n in order),
        "complexity": {"time": "O(V + E)", "space": "O(V)"},
    }
