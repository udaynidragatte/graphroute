"""Depth First Search implemented by hand, both recursively and with a stack.

Time:  O(V + E)
Space: O(V)
"""

from __future__ import annotations

from typing import Any, Dict, List

from .graph import Graph


def dfs_recursive(graph: Graph, start: str, trace: bool = True) -> Dict[str, Any]:
    """Recursive DFS. ``trace`` records stack operations for the visualiser."""
    if not graph.has_node(start):
        raise ValueError(f"Start node '{start}' does not exist")

    visited = set()
    order: List[str] = []
    parent: Dict[str, str | None] = {start: None}
    discovery: Dict[str, int] = {}
    finish: Dict[str, int] = {}
    tree_edges: List[List[str]] = []
    stack_ops: List[Dict[str, Any]] = []
    log = stack_ops.append if trace else (lambda _entry: None)
    timer = {"t": 0}

    def visit(node: str) -> None:
        visited.add(node)
        timer["t"] += 1
        discovery[node] = timer["t"]
        order.append(node)
        log({"action": "discover", "node": node, "stack": list(reversed(_active))})

        _active.append(node)
        for neighbour in sorted(graph.get_neighbors(node)):
            if neighbour not in visited:
                parent[neighbour] = node
                tree_edges.append([node, neighbour])
                visit(neighbour)
            else:
                log(                    {"action": "skip", "node": neighbour, "from": node, "reason": "already visited", "stack": list(reversed(_active))}
                )
        _active.pop()
        timer["t"] += 1
        finish[node] = timer["t"]
        log({"action": "backtrack", "node": node, "stack": list(reversed(_active))})

    _active: List[str] = []
    visit(start)

    return _result(graph, "DFS (recursive)", start, order, parent, discovery, finish, tree_edges, stack_ops)


def dfs_iterative(graph: Graph, start: str, trace: bool = True) -> Dict[str, Any]:
    if not graph.has_node(start):
        raise ValueError(f"Start node '{start}' does not exist")

    visited: set[str] = set()
    order: List[str] = []
    parent: Dict[str, str | None] = {start: None}
    discovery: Dict[str, int] = {}
    finish: Dict[str, int] = {}
    tree_edges: List[List[str]] = []
    stack_ops: List[Dict[str, Any]] = []
    log = stack_ops.append if trace else (lambda _entry: None)

    # Stack holds (node, iterator of remaining neighbours); this is an explicit
    # simulation of the recursion stack so backtracking is visible.
    stack: List[List[Any]] = [[start, iter(sorted(graph.get_neighbors(start)))]]
    log({"action": "push", "node": start, "stack": [frame[0] for frame in stack]})
    visited.add(start)
    order.append(start)
    discovery[start] = 1
    step = 1

    while stack:
        node, neighbours = stack[-1]
        advanced = False
        for neighbour in neighbours:
            if neighbour in visited:
                log(                    {"action": "skip", "node": neighbour, "from": node, "reason": "already visited", "stack": [f[0] for f in stack]}
                )
                continue
            visited.add(neighbour)
            step += 1
            discovery[neighbour] = step
            order.append(neighbour)
            parent[neighbour] = node
            tree_edges.append([node, neighbour])
            stack.append([neighbour, iter(sorted(graph.get_neighbors(neighbour)))])
            log({"action": "push", "node": neighbour, "from": node, "stack": [f[0] for f in stack]})
            advanced = True
            break
        if not advanced:
            popped, _ = stack.pop()
            step += 1
            finish[popped] = step
            log({"action": "pop", "node": popped, "stack": [f[0] for f in stack]})

    return _result(graph, "DFS (iterative)", start, order, parent, discovery, finish, tree_edges, stack_ops)


def _result(
    graph: Graph,
    label: str,
    start: str,
    order: List[str],
    parent: Dict[str, str | None],
    discovery: Dict[str, int],
    finish: Dict[str, int],
    tree_edges: List[List[str]],
    stack_ops: List[Dict[str, Any]],
) -> Dict[str, Any]:
    visited = set(order)
    return {
        "algorithm": label,
        "start": start,
        "order": order,
        "visited": order,
        "unreachable": [node for node in graph.get_nodes() if node not in visited],
        "parent": parent,
        "discovery": discovery,
        "finish": finish,
        "tree_edges": tree_edges,
        "stack_ops": stack_ops,
        "edge_operations": sum(len(graph.get_neighbors(n)) for n in order),
        "complexity": {"time": "O(V + E)", "space": "O(V)"},
    }


def dfs(graph: Graph, start: str, mode: str = "recursive", trace: bool = True) -> Dict[str, Any]:
    if mode == "iterative":
        return dfs_iterative(graph, start, trace=trace)
    return dfs_recursive(graph, start, trace=trace)
