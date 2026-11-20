"""Unit tests for the graph data structure and every algorithm."""

from __future__ import annotations

import math

import pytest

from app.algorithms.bellman_ford import bellman_ford
from app.algorithms.bfs import bfs
from app.algorithms.dfs import dfs, dfs_iterative, dfs_recursive
from app.algorithms.dijkstra import dijkstra
from app.algorithms.graph import Graph, GraphError
from app.algorithms.routes import alternative_routes
from app.analysis.analysis import analyze, connected_components, connectivity, has_cycle


def sample_graph() -> Graph:
    g = Graph(directed=False, weighted=True)
    for node in ["A", "B", "C", "D", "E"]:
        g.add_node(node)
    g.add_edge("A", "B", 4)
    g.add_edge("A", "C", 2)
    g.add_edge("B", "C", 5)
    g.add_edge("B", "D", 10)
    g.add_edge("C", "E", 3)
    g.add_edge("E", "D", 4)
    return g


# --------------------------------------------------------------- graph basics
def test_add_and_get_nodes():
    g = Graph()
    g.add_node("A", {"kind": "city"})
    assert g.get_nodes() == ["A"]
    assert g.graph_exists()
    assert g.get_metadata("A") == {"kind": "city"}


def test_duplicate_node_rejected():
    g = Graph()
    g.add_node("A")
    with pytest.raises(GraphError):
        g.add_node("A")


def test_blank_node_id_rejected():
    g = Graph()
    with pytest.raises(GraphError):
        g.add_node("   ")


def test_remove_node_removes_incident_edges():
    g = sample_graph()
    g.remove_node("B")
    assert "B" not in g.get_nodes()
    assert all("B" not in (u, v) for u, v, _ in g.get_edges())


def test_remove_missing_node_raises():
    g = Graph()
    with pytest.raises(GraphError):
        g.remove_node("nope")


def test_undirected_edge_is_stored_both_ways():
    g = Graph()
    g.add_node("A")
    g.add_node("B")
    g.add_edge("A", "B", 7)
    assert g.get_neighbors("A") == {"B": 7.0}
    assert g.get_neighbors("B") == {"A": 7.0}
    assert len(g.get_edges()) == 1
    assert g.get_degree("A") == 1


def test_directed_edge_is_one_way():
    g = Graph(directed=True)
    g.add_node("A")
    g.add_node("B")
    g.add_edge("A", "B", 2)
    assert g.get_neighbors("B") == {}
    assert g.get_edges() == [("A", "B", 2.0)]


def test_duplicate_edge_rejected():
    g = sample_graph()
    with pytest.raises(GraphError):
        g.add_edge("A", "B", 1)


def test_self_loop_rejected():
    g = sample_graph()
    with pytest.raises(GraphError):
        g.add_edge("A", "A", 1)


def test_invalid_weight_rejected():
    g = sample_graph()
    with pytest.raises(GraphError):
        g.add_edge("A", "D", float("nan"))
    with pytest.raises(GraphError):
        g.update_edge_weight("A", "B", "heavy")  # type: ignore[arg-type]


def test_edge_to_missing_node_rejected():
    g = sample_graph()
    with pytest.raises(GraphError):
        g.add_edge("A", "ZZ", 3)


def test_update_edge_weight_syncs_both_directions():
    g = sample_graph()
    g.update_edge_weight("A", "B", 1.5)
    assert g.get_neighbors("A")["B"] == 1.5
    assert g.get_neighbors("B")["A"] == 1.5


def test_remove_edge():
    g = sample_graph()
    g.remove_edge("A", "B")
    assert "B" not in g.get_neighbors("A")
    with pytest.raises(GraphError):
        g.remove_edge("A", "B")


def test_clear_graph():
    g = sample_graph()
    g.clear_graph()
    assert g.get_nodes() == []
    assert not g.graph_exists()


# ---------------------------------------------------------------------- BFS
def test_bfs_order_and_levels():
    result = bfs(sample_graph(), "A")
    assert result["order"][0] == "A"
    assert set(result["visited"]) == {"A", "B", "C", "D", "E"}
    assert result["levels"]["A"] == 0
    assert result["levels"]["B"] == 1
    assert result["levels"]["C"] == 1
    assert result["levels"]["D"] == 2
    assert result["unreachable"] == []
    assert ["A", "B"] in result["tree_edges"]
    assert result["complexity"]["time"] == "O(V + E)"


def test_bfs_reachability_on_disconnected_graph():
    g = Graph()
    for node in ["A", "B", "C", "D"]:
        g.add_node(node)
    g.add_edge("A", "B", 1)
    g.add_node("Z")
    result = bfs(g, "A")
    assert result["visited"] == ["A", "B"]
    assert result["unreachable"] == ["C", "D", "Z"]


def test_bfs_invalid_start():
    with pytest.raises(ValueError):
        bfs(sample_graph(), "missing")


def test_bfs_single_node():
    g = Graph()
    g.add_node("only")
    result = bfs(g, "only")
    assert result["order"] == ["only"]
    assert result["levels"] == {"only": 0}


# ---------------------------------------------------------------------- DFS
def test_dfs_visits_every_node_once():
    result = dfs_recursive(sample_graph(), "A")
    assert result["order"][0] == "A"
    assert sorted(result["order"]) == ["A", "B", "C", "D", "E"]
    assert len(result["order"]) == len(set(result["order"]))


def test_dfs_iterative_matches_recursive_coverage():
    graph = sample_graph()
    recursive = dfs_recursive(graph, "A")
    iterative = dfs_iterative(graph, "A")
    assert sorted(recursive["visited"]) == sorted(iterative["visited"])
    assert iterative["unreachable"] == []


def test_dfs_backtracking_recorded():
    result = dfs_recursive(sample_graph(), "A")
    actions = {op["action"] for op in result["stack_ops"]}
    assert "backtrack" in actions


def test_dfs_invalid_start():
    with pytest.raises(ValueError):
        dfs(sample_graph(), "missing", "iterative")


# ----------------------------------------------------------------- Dijkstra
def test_dijkstra_shortest_path():
    result = dijkstra(sample_graph(), "A", "D")
    # A->C->E->D = 2 + 3 + 4 = 9 is cheaper than A->B->D = 14
    assert result["distance"] == 9
    assert result["path"] == ["A", "C", "E", "D"]
    assert result["hops"] == 3


def test_dijkstra_unreachable_destination():
    g = Graph()
    for node in ["A", "B", "C"]:
        g.add_node(node)
    g.add_edge("A", "B", 1)
    result = dijkstra(g, "A", "C")
    assert result["distance"] is None
    assert result["path"] == []


def test_dijkstra_rejects_negative_weight():
    g = Graph(directed=True)
    for node in ["A", "B"]:
        g.add_node(node)
    g.add_edge("A", "B", -5)
    with pytest.raises(ValueError, match="non-negative"):
        dijkstra(g, "A", "B")


def test_dijkstra_invalid_source():
    with pytest.raises(ValueError):
        dijkstra(sample_graph(), "zzz")


def test_dijkstra_directed_respects_direction():
    g = Graph(directed=True)
    for node in ["A", "B", "C"]:
        g.add_node(node)
    g.add_edge("A", "B", 1)
    g.add_edge("B", "C", 1)
    assert dijkstra(g, "A", "C")["distance"] == 2
    assert dijkstra(g, "C", "A")["distance"] is None


# ------------------------------------------------------------- Bellman-Ford
def test_bellman_ford_matches_dijkstra_on_positive_graph():
    graph = sample_graph()
    assert bellman_ford(graph, "A", "D")["distance"] == dijkstra(graph, "A", "D")["distance"] == 9


def test_bellman_ford_handles_negative_weight():
    g = Graph(directed=True)
    for node in ["S", "A", "B", "T"]:
        g.add_node(node)
    g.add_edge("S", "A", 4)
    g.add_edge("S", "B", 5)
    g.add_edge("A", "B", -3)
    g.add_edge("B", "T", 2)
    result = bellman_ford(g, "S", "T")
    # S->A->B->T = 4 - 3 + 2 = 3, cheaper than S->B->T = 7
    assert result["distance"] == 3
    assert result["path"] == ["S", "A", "B", "T"]
    assert result["has_negative_cycle"] is False


def test_bellman_ford_detects_negative_cycle():
    g = Graph(directed=True)
    for node in ["A", "B", "C"]:
        g.add_node(node)
    g.add_edge("A", "B", 1)
    g.add_edge("B", "C", -2)
    g.add_edge("C", "A", -2)
    result = bellman_ford(g, "A", "C")
    assert result["has_negative_cycle"] is True
    assert len(result["negative_cycle"]) >= 3


def test_bellman_ford_invalid_source():
    with pytest.raises(ValueError):
        bellman_ford(sample_graph(), "nope")


# --------------------------------------------------------------- alternatives
def test_alternative_routes_sorted_by_cost():
    result = alternative_routes(sample_graph(), "A", "D")
    costs = [item["cost"] for item in result["paths"]]
    assert costs == sorted(costs)
    assert all(item["path"][0] == "A" and item["path"][-1] == "D" for item in result["paths"])


# ------------------------------------------------------------------- analysis
def test_connected_components_and_isolated():
    g = Graph()
    for node in ["A", "B", "C", "D"]:
        g.add_node(node)
    g.add_edge("A", "B", 1)
    g.add_node("SOLO")
    components = connected_components(g)
    assert len(components) == 4  # {A,B}, {C}, {D}, {SOLO}
    stats = analyze(g)
    assert stats["isolated_nodes"] == ["C", "D", "SOLO"]
    assert stats["component_count"] == 4
    assert stats["average_degree"] == pytest.approx(0.4)


def test_density_formula_undirected_and_directed():
    undirected = Graph(directed=False)
    for node in ["A", "B", "C"]:
        undirected.add_node(node)
    undirected.add_edge("A", "B", 1)
    undirected.add_edge("B", "C", 2)
    stats = analyze(undirected)
    assert stats["network_density"] == pytest.approx(2 * 2 / (3 * 2))

    directed = Graph(directed=True)
    for node in ["A", "B", "C"]:
        directed.add_node(node)
    directed.add_edge("A", "B", 1)
    assert analyze(directed)["network_density"] == pytest.approx(1 / (3 * 2), rel=1e-4)


def test_analysis_safe_for_empty_and_single_node_graphs():
    empty = analyze(Graph())
    assert empty["node_count"] == 0 and empty["network_density"] == 0
    single = Graph()
    single.add_node("A")
    stats = analyze(single)
    assert stats["network_density"] == 0
    assert stats["connected"] is True


def test_cycle_detection():
    g = Graph()
    for node in ["A", "B", "C"]:
        g.add_node(node)
    g.add_edge("A", "B", 1)
    g.add_edge("B", "C", 1)
    assert has_cycle(g) is False
    g.add_edge("C", "A", 1)
    assert has_cycle(g) is True


def test_cycle_detection_directed():
    g = Graph(directed=True)
    for node in ["A", "B", "C"]:
        g.add_node(node)
    g.add_edge("A", "B", 1)
    g.add_edge("B", "C", 1)
    assert has_cycle(g) is False
    g.add_edge("C", "A", 1)
    assert has_cycle(g) is True


def test_connectivity_report():
    g = sample_graph()
    g.add_node("ISOLATED")
    result = connectivity(g, "A")
    assert result["reachable_count"] == 5
    assert result["unreachable"] == ["ISOLATED"]
    assert result["reachability_percentage"] == pytest.approx(83.33, abs=0.01)
    assert result["isolated_nodes"] == ["ISOLATED"]


def test_connectivity_invalid_source():
    with pytest.raises(ValueError):
        connectivity(sample_graph(), "nope")


def test_strong_components_directed():
    g = Graph(directed=True)
    for node in ["A", "B", "C", "D"]:
        g.add_node(node)
    g.add_edge("A", "B", 1)
    g.add_edge("B", "A", 1)
    g.add_edge("B", "C", 1)
    result = connectivity(g, "A")
    assert len(result["strong_components"]) == 3  # {A,B}, {C}, {D}
    assert result["strongly_connected"] is False
    assert result["weakly_connected"] is False


def test_empty_graph_algorithms_raise_cleanly():
    with pytest.raises(ValueError):
        bfs(Graph(), "A")
    assert analyze(Graph())["edge_count"] == 0


def test_infinity_never_leaks_into_json():
    result = dijkstra(sample_graph(), "A", "D")
    assert all(value is None or isinstance(value, (int, float)) for value in result["distances"].values())
    assert not any(isinstance(v, float) and math.isinf(v) for v in result["distances"].values())


def test_generator_builds_requested_density_without_duplicate_edges():
    from app.analysis.generators import generate_graph

    for directed in (False, True):
        graph = generate_graph(node_count=40, density=0.5, directed=directed, connected=True, seed=7)
        assert graph.node_count() == 40
        expected = int(0.5 * 40 * 39 / (1 if directed else 2))
        assert graph.edge_count() == expected
        assert len({(u, v, w) for u, v, w in graph.get_edges()}) == graph.edge_count()
        # Undirected graphs must never contain both A->B and B->A as distinct edges.
        pairs = {(u, v) for u, v, _ in graph.get_edges()}
        if not directed:
            assert not any((v, u) in pairs for u, v in pairs)


def test_algorithms_return_same_answer_with_tracing_disabled():
    from app.analysis.generators import generate_graph

    graph = generate_graph(node_count=30, density=0.25, directed=False, connected=True, seed=11)
    nodes = graph.get_nodes()
    source, destination = nodes[0], nodes[-1]

    for traced, plain in (
        (bfs(graph, source), bfs(graph, source, trace=False)),
        (dfs(graph, source), dfs(graph, source, trace=False)),
        (dijkstra(graph, source, destination), dijkstra(graph, source, destination, trace=False)),
        (bellman_ford(graph, source, destination), bellman_ford(graph, source, destination, trace=False)),
    ):
        for key in ("visited", "order", "path", "distance", "relaxations", "edge_operations"):
            if key in traced:
                assert plain[key] == traced[key], key
    assert dijkstra(graph, source, destination, trace=False)["trace"] == []
    assert bellman_ford(graph, source, destination, trace=False)["trace"] == []
    assert bfs(graph, source, trace=False)["queue_ops"] == []
    assert dfs(graph, source, trace=False)["stack_ops"] == []
    assert dijkstra(graph, source, destination)["distance"] == dijkstra(
        graph, source, destination, trace=False
    )["distance"]
