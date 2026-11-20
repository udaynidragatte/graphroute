"""Adjacency-list graph implementation.

The graph is stored as a hash table (Python dict) mapping a node id to another
hash table of neighbours -> weight. That makes node/edge lookup O(1) on average.

All algorithms in this package operate on this class, not on NetworkX, so the
implementation can be explained line by line during a viva.
"""

from __future__ import annotations

import math
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple


class GraphError(ValueError):
    """Raised for invalid graph operations (bad ids, duplicate nodes, ...)."""


class Graph:
    def __init__(self, directed: bool = False, weighted: bool = True) -> None:
        self.directed = directed
        self.weighted = weighted
        # adjacency list: node -> {neighbour: weight}
        self._adjacency: Dict[str, Dict[str, float]] = {}
        self._metadata: Dict[str, Dict[str, Any]] = {}

    # ------------------------------------------------------------------ nodes
    def add_node(self, node_id: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        node_id = self._validate_node_id(node_id)
        if node_id in self._adjacency:
            raise GraphError(f"Node '{node_id}' already exists")
        self._adjacency[node_id] = {}
        self._metadata[node_id] = dict(metadata or {})

    def remove_node(self, node_id: str) -> None:
        self._require_node(node_id)
        del self._adjacency[node_id]
        self._metadata.pop(node_id, None)
        for neighbours in self._adjacency.values():
            neighbours.pop(node_id, None)

    def has_node(self, node_id: str) -> bool:
        return node_id in self._adjacency

    def graph_exists(self) -> bool:
        """A graph "exists" once it has at least one node."""
        return len(self._adjacency) > 0

    def get_nodes(self) -> List[str]:
        return list(self._adjacency.keys())

    def get_metadata(self, node_id: str) -> Dict[str, Any]:
        self._require_node(node_id)
        return self._metadata.get(node_id, {})

    def set_metadata(self, node_id: str, metadata: Dict[str, Any]) -> None:
        self._require_node(node_id)
        self._metadata[node_id] = dict(metadata or {})

    # ------------------------------------------------------------------ edges
    def add_edge(self, source: str, target: str, weight: float = 1.0) -> None:
        self._require_node(source)
        self._require_node(target)
        if source == target:
            raise GraphError("Self-loops are not allowed")
        weight = self._validate_weight(weight)

        existing = self._adjacency[source].get(target)
        if existing is not None:
            if self.directed:
                raise GraphError(f"Edge {source} -> {target} already exists")
            raise GraphError(f"Edge {source} -- {target} already exists")

        self._adjacency[source][target] = weight
        if not self.directed:
            self._adjacency[target][source] = weight

    def remove_edge(self, source: str, target: str) -> None:
        self._require_node(source)
        self._require_node(target)
        if target not in self._adjacency[source]:
            raise GraphError(f"Edge {source} -> {target} does not exist")
        del self._adjacency[source][target]
        if not self.directed:
            self._adjacency[target].pop(source, None)

    def has_edge(self, source: str, target: str) -> bool:
        if source not in self._adjacency:
            return False
        return target in self._adjacency[source]

    def update_edge_weight(self, source: str, target: str, weight: float) -> None:
        self._require_node(source)
        self._require_node(target)
        weight = self._validate_weight(weight)
        if target not in self._adjacency[source]:
            raise GraphError(f"Edge {source} -> {target} does not exist")
        self._adjacency[source][target] = weight
        if not self.directed:
            self._adjacency[target][source] = weight

    def get_neighbors(self, node_id: str) -> Dict[str, float]:
        self._require_node(node_id)
        return dict(self._adjacency[node_id])

    def get_edges(self) -> List[Tuple[str, str, float]]:
        """Unique edge list. Undirected edges are reported once."""
        seen: Set[Tuple[str, str]] = set()
        edges: List[Tuple[str, str, float]] = []
        for source, neighbours in self._adjacency.items():
            for target, weight in neighbours.items():
                key = (source, target) if self.directed else tuple(sorted((source, target)))
                if key in seen:
                    continue
                seen.add(key)
                edges.append((source, target, weight))
        return edges

    # ------------------------------------------------------------------ stats
    def get_degree(self, node_id: str) -> int:
        """Out-degree for directed graphs, degree for undirected graphs."""
        self._require_node(node_id)
        return len(self._adjacency[node_id])

    def total_degree(self) -> int:
        if self.directed:
            return sum(len(n) for n in self._adjacency.values())
        return sum(len(n) for n in self._adjacency.values())

    def clear_graph(self) -> None:
        self._adjacency.clear()
        self._metadata.clear()

    def node_count(self) -> int:
        return len(self._adjacency)

    def edge_count(self) -> int:
        return len(self.get_edges())

    def to_adjacency(self) -> Dict[str, Dict[str, float]]:
        return {node: dict(neighbours) for node, neighbours in self._adjacency.items()}

    def undirected_adjacency(self) -> Dict[str, Set[str]]:
        """Neighbour sets ignoring edge direction (used for weak connectivity)."""
        adj: Dict[str, Set[str]] = {n: set() for n in self._adjacency}
        for source, neighbours in self._adjacency.items():
            for target in neighbours:
                adj[source].add(target)
                adj[target].add(source)
        return adj

    def reverse_adjacency(self) -> Dict[str, Set[str]]:
        rev: Dict[str, Set[str]] = {n: set() for n in self._adjacency}
        for source, neighbours in self._adjacency.items():
            for target in neighbours:
                rev[target].add(source)
        return rev

    # ------------------------------------------------------------- validation
    @staticmethod
    def _validate_node_id(node_id: Any) -> str:
        if not isinstance(node_id, str):
            raise GraphError("Node id must be a string")
        cleaned = node_id.strip()
        if not cleaned:
            raise GraphError("Node id must not be empty")
        if len(cleaned) > 80:
            raise GraphError("Node id must be at most 80 characters")
        return cleaned

    @staticmethod
    def _validate_weight(weight: Any) -> float:
        try:
            value = float(weight)
        except (TypeError, ValueError) as exc:
            raise GraphError("Edge weight must be a number") from exc
        if not math.isfinite(value):
            raise GraphError("Edge weight must be finite")
        if abs(value) > 1e9:
            raise GraphError("Edge weight is out of the supported range")
        return value

    def _require_node(self, node_id: str) -> None:
        if node_id not in self._adjacency:
            raise GraphError(f"Node '{node_id}' does not exist")

    def __len__(self) -> int:
        return len(self._adjacency)

    def __contains__(self, node_id: object) -> bool:
        return node_id in self._adjacency

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"Graph(directed={self.directed}, nodes={self.node_count()}, edges={self.edge_count()})"


def adjacency_text(graph: Graph) -> str:
    """Readable adjacency-list dump for the UI."""
    lines = []
    for node in graph.get_nodes():
        neighbours = graph.get_neighbors(node)
        pretty: Iterable[str] = (f"{n}:{w:g}" for n, w in sorted(neighbours.items()))
        lines.append(f"{node} -> {', '.join(pretty) if neighbours else '(none)'}")
    return "\n".join(lines)
