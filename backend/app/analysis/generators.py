"""Random graph generators used by the benchmark module.

Generation time is measured separately and excluded from algorithm timings.
"""

from __future__ import annotations

import random
from typing import Any, Dict

from ..algorithms.graph import Graph


def generate_graph(
    node_count: int,
    density: float = 0.1,
    directed: bool = False,
    weighted: bool = True,
    connected: bool = True,
    weighted_negative: bool = False,
    seed: int | None = None,
) -> Graph:
    if node_count < 1:
        raise ValueError("node_count must be at least 1")
    if not 0 < density <= 1:
        raise ValueError("density must be between 0 and 1")

    rng = random.Random(seed)
    graph = Graph(directed=directed, weighted=weighted)
    labels = [f"N{i}" for i in range(node_count)]
    for label in labels:
        graph.add_node(label)

    def weight() -> float:
        value = rng.randint(1, 20)
        if weighted_negative and rng.random() < 0.25:
            return -value
        return float(value)

    if connected and node_count > 1:
        # Random spanning tree guarantees connectivity.
        for i in range(1, node_count):
            parent = rng.randrange(i)
            graph.add_edge(labels[parent], labels[i], weight())

    # Track pairs by node *label*, because that is what Graph.add_edge uses as
    # its identity. Undirected graphs are keyed in both directions so a
    # reversed pair is recognised as the same edge.
    seen = {(u, v) for u, v, _ in graph.get_edges()}
    if not directed:
        seen |= {(v, u) for u, v in seen}

    target_edges = int(density * node_count * (node_count - 1) / (1 if directed else 2))
    target_edges = max(target_edges, node_count - 1 if connected else 0)
    attempts = 0
    max_attempts = target_edges * 20 + 100
    while graph.edge_count() < target_edges and attempts < max_attempts:
        attempts += 1
        u = labels[rng.randrange(node_count)]
        v = labels[rng.randrange(node_count)]
        if u == v or (u, v) in seen:
            continue
        graph.add_edge(u, v, weight())
        seen.add((u, v))
        if not directed:
            seen.add((v, u))

    return graph


def graph_summary(graph: Graph) -> Dict[str, Any]:
    return {
        "node_count": graph.node_count(),
        "edge_count": graph.edge_count(),
        "directed": graph.directed,
        "weighted": graph.weighted,
    }
