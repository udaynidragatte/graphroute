"""Network analysis: density, degrees, components, cycles, connectivity."""

from __future__ import annotations

from typing import Any, Dict, List, Set

from ..algorithms.graph import Graph


def connected_components(graph: Graph) -> List[List[str]]:
    """Components of the underlying undirected graph (weak components for digraphs)."""
    adj = graph.undirected_adjacency()
    seen: Set[str] = set()
    components: List[List[str]] = []
    for node in graph.get_nodes():
        if node in seen:
            continue
        stack = [node]
        seen.add(node)
        component: List[str] = []
        while stack:
            current = stack.pop()
            component.append(current)
            for neighbour in adj[current]:
                if neighbour not in seen:
                    seen.add(neighbour)
                    stack.append(neighbour)
        components.append(sorted(component))
    components.sort(key=lambda c: (-len(c), c[0]))
    return components


def strong_components(graph: Graph) -> List[List[str]]:
    """Kosaraju's algorithm. Only meaningful for directed graphs."""
    visited: Set[str] = set()
    order: List[str] = []

    def fill(node: str) -> None:
        visited.add(node)
        for neighbour in graph.get_neighbors(node):
            if neighbour not in visited:
                fill(neighbour)
        order.append(node)

    for node in graph.get_nodes():
        if node not in visited:
            fill(node)

    reverse = graph.reverse_adjacency()
    assigned: Set[str] = set()
    components: List[List[str]] = []
    for node in reversed(order):
        if node in assigned:
            continue
        stack = [node]
        assigned.add(node)
        component = []
        while stack:
            current = stack.pop()
            component.append(current)
            for neighbour in reverse[current]:
                if neighbour not in assigned:
                    assigned.add(neighbour)
                    stack.append(neighbour)
        components.append(sorted(component))
    components.sort(key=lambda c: (-len(c), c[0]))
    return components


def has_cycle(graph: Graph) -> bool:
    if graph.directed:
        WHITE, GRAY, BLACK = 0, 1, 2
        color = {node: WHITE for node in graph.get_nodes()}

        def visit(node: str) -> bool:
            color[node] = GRAY
            for neighbour in graph.get_neighbors(node):
                if color[neighbour] == GRAY:
                    return True
                if color[neighbour] == WHITE and visit(neighbour):
                    return True
            color[node] = BLACK
            return False

        return any(color[node] == WHITE and visit(node) for node in graph.get_nodes())

    # Undirected: DFS ignoring the edge we came from.
    seen: Set[str] = set()

    def visit(node: str, parent: str | None) -> bool:
        seen.add(node)
        for neighbour in graph.get_neighbors(node):
            if neighbour == parent:
                continue
            if neighbour in seen:
                return True
            if visit(neighbour, node):
                return True
        return False

    return any(node not in seen and visit(node, None) for node in graph.get_nodes())


def degrees(graph: Graph) -> Dict[str, int]:
    if graph.directed:
        degree = {node: 0 for node in graph.get_nodes()}
        for source, neighbours in graph.to_adjacency().items():
            degree[source] += len(neighbours)
        for target in graph.get_nodes():
            degree[target] += sum(1 for u, v, _ in graph.get_edges() if v == target)
        return degree
    return {node: graph.get_degree(node) for node in graph.get_nodes()}


def analyze(graph: Graph) -> Dict[str, Any]:
    nodes = graph.get_nodes()
    v = len(nodes)
    edges = graph.get_edges()
    e = len(edges)
    deg = degrees(graph)
    degree_values = list(deg.values())
    components = connected_components(graph)

    if v >= 2:
        density = (e / (v * (v - 1))) if graph.directed else (2 * e / (v * (v - 1)))
    else:
        density = 0.0

    isolated = sorted(node for node in nodes if deg.get(node, 0) == 0)
    distribution: Dict[int, int] = {}
    for value in degree_values:
        distribution[value] = distribution.get(value, 0) + 1

    return {
        "node_count": v,
        "edge_count": e,
        "directed": graph.directed,
        "weighted": graph.weighted,
        "average_degree": round(sum(degree_values) / v, 4) if v else 0.0,
        "max_degree": max(degree_values) if degree_values else 0,
        "min_degree": min(degree_values) if degree_values else 0,
        "isolated_nodes": isolated,
        "components": components,
        "component_count": len(components),
        "largest_component": len(components[0]) if components else 0,
        "reachability_percentage": round(100.0 * (len(components[0]) / v), 2) if v and components else 0.0,
        "network_density": round(density, 6),
        "density_percent": round(density * 100, 2),
        "has_cycle": has_cycle(graph) if v else False,
        "connected": len(components) <= 1 if v else False,
        "degree_distribution": [{"degree": k, "count": distribution[k]} for k in sorted(distribution)],
        "total_degree": sum(degree_values),
        "dangling_edges": 0 if not graph.directed else sum(1 for _, __, ___ in edges),
    }


def connectivity(graph: Graph, source: str) -> Dict[str, Any]:
    if not graph.has_node(source):
        raise ValueError(f"Source node '{source}' does not exist")

    reachable: List[str] = []
    seen = {source}
    stack = [source]
    order: List[str] = []
    while stack:
        current = stack.pop()
        order.append(current)
        reachable.append(current)
        for neighbour in graph.get_neighbors(current):
            if neighbour not in seen:
                seen.add(neighbour)
                stack.append(neighbour)

    unreachable = [node for node in graph.get_nodes() if node not in seen]
    total = len(graph.get_nodes())
    components = connected_components(graph)
    strong = strong_components(graph) if graph.directed else []
    strong_ids = {node: idx for idx, comp in enumerate(strong) for node in comp}

    weak_connected = len(components) <= 1
    strongly_connected = (len(strong) <= 1) if graph.directed else weak_connected

    return {
        "source": source,
        "reachable": reachable,
        "unreachable": unreachable,
        "reachable_count": len(reachable),
        "unreachable_count": len(unreachable),
        "reachability_percentage": round(100.0 * len(reachable) / total, 2) if total else 0.0,
        "components": components,
        "isolated_nodes": sorted(node for node in graph.get_nodes() if graph.get_degree(node) == 0),
        "directed": graph.directed,
        "weakly_connected": weak_connected,
        "strongly_connected": strongly_connected,
        "strong_components": strong if graph.directed else [],
        "strong_component_of_source": strong_ids.get(source) if graph.directed else None,
    }
