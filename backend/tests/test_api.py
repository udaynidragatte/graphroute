"""Integration tests for the REST API."""

from __future__ import annotations

import json


def new_graph(client, name, directed=False, weighted=True):
    response = client.post(
        "/api/graphs",
        json={"name": name, "description": "test graph", "directed": directed, "weighted": weighted},
    )
    assert response.status_code == 201, response.text
    return response.json()


def build_diamond(client, name="Diamond"):
    graph = new_graph(client, name)
    gid = graph["id"]
    for index, label in enumerate(["A", "B", "C", "D"]):
        response = client.post(
            f"/api/graphs/{gid}/nodes",
            json={"label": label, "x_position": index * 100, "y_position": index * 50, "metadata": {}},
        )
        assert response.status_code == 201, response.text
    for source, target, weight in [("A", "B", 1), ("A", "C", 4), ("B", "D", 2), ("C", "D", 1)]:
        response = client.post(
            f"/api/graphs/{gid}/edges",
            json={"source_node": source, "target_node": target, "weight": weight},
        )
        assert response.status_code == 201, response.text
    return gid


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_seed_creates_samples(client, seeded_graphs):
    names = {graph["name"] for graph in seeded_graphs}
    assert {"College Campus", "City Transport", "Computer Network", "Custom Graph"} <= names
    campus = next(graph for graph in seeded_graphs if graph["name"] == "College Campus")
    assert campus["node_count"] == 7
    assert campus["edge_count"] == 10


def test_create_get_update_delete_graph(client):
    graph = new_graph(client, "CRUD Graph")
    gid = graph["id"]

    assert client.get(f"/api/graphs/{gid}").json()["name"] == "CRUD Graph"
    updated = client.put(f"/api/graphs/{gid}", json={"name": "CRUD Graph Renamed", "description": "changed"})
    assert updated.status_code == 200
    assert updated.json()["name"] == "CRUD Graph Renamed"

    assert client.delete(f"/api/graphs/{gid}").status_code == 204
    assert client.get(f"/api/graphs/{gid}").status_code == 404


def test_duplicate_graph_name_conflict(client):
    new_graph(client, "Unique Name")
    response = client.post("/api/graphs", json={"name": "Unique Name", "directed": False, "weighted": True})
    assert response.status_code == 409


def test_node_and_edge_crud(client):
    gid = build_diamond(client, "Node Edge CRUD")

    duplicate = client.post(f"/api/graphs/{gid}/nodes", json={"label": "A"})
    assert duplicate.status_code == 409

    self_loop = client.post(f"/api/graphs/{gid}/edges", json={"source_node": "A", "target_node": "A", "weight": 1})
    assert self_loop.status_code == 409

    missing_node_edge = client.post(f"/api/graphs/{gid}/edges", json={"source_node": "A", "target_node": "ZZ", "weight": 1})
    assert missing_node_edge.status_code == 409

    edge_id = client.get(f"/api/graphs/{gid}").json()["edges"][0]["id"]
    patched = client.patch(f"/api/graphs/{gid}/edges/{edge_id}", json={"weight": 42})
    assert patched.status_code == 200
    assert any(edge["weight"] == 42 for edge in patched.json()["edges"])

    deleted = client.delete(f"/api/graphs/{gid}/edges", params={"source_node": "A", "target_node": "B"})
    assert deleted.status_code == 200
    assert all(not (e["source_node"] == "A" and e["target_node"] == "B") for e in deleted.json()["edges"])

    removed = client.delete(f"/api/graphs/{gid}/nodes/B")
    assert removed.status_code == 200
    assert all(node["label"] != "B" for node in removed.json()["nodes"])
    assert all("B" not in (e["source_node"], e["target_node"]) for e in removed.json()["edges"])


def test_structure_replace_roundtrip(client):
    gid = build_diamond(client, "Structure Replace")
    payload = {
        "nodes": [
            {"label": "X", "x_position": 10, "y_position": 20, "metadata": {"team": "core"}},
            {"label": "Y", "x_position": 30, "y_position": 40, "metadata": {}},
        ],
        "edges": [{"source_node": "X", "target_node": "Y", "weight": 5}],
    }
    response = client.put(f"/api/graphs/{gid}/structure", json=payload)
    assert response.status_code == 200, response.text
    body = response.json()
    assert len(body["nodes"]) == 2 and len(body["edges"]) == 1
    assert body["nodes"][0]["metadata"] == {"team": "core"}

    invalid = client.put(
        f"/api/graphs/{gid}/structure",
        json={"nodes": [{"label": "X"}], "edges": [{"source_node": "X", "target_node": "Y", "weight": 1}]},
    )
    assert invalid.status_code in (400, 409, 422)


def test_reset_duplicate_and_activities(client):
    gid = build_diamond(client, "Duplicate Source")
    clone = client.post(f"/api/graphs/{gid}/duplicate")
    assert clone.status_code == 201
    assert clone.json()["node_count"] == 4
    assert "copy" in clone.json()["name"]

    reset = client.post(f"/api/graphs/{gid}/reset")
    assert reset.status_code == 200
    assert reset.json()["nodes"] == [] and reset.json()["edges"] == []

    activities = client.get("/api/activities", params={"limit": 5})
    assert activities.status_code == 200
    assert len(activities.json()) > 0


def test_bfs_and_dfs_endpoints(client):
    gid = build_diamond(client, "Traversal Graph")
    bfs = client.post("/api/algorithms/bfs", json={"graph_id": gid, "start": "A"})
    assert bfs.status_code == 200, bfs.text
    assert bfs.json()["order"][0] == "A"
    assert bfs.json()["levels"]["D"] == 2

    dfs_recursive = client.post("/api/algorithms/dfs", json={"graph_id": gid, "start": "A", "mode": "recursive"})
    dfs_iterative = client.post("/api/algorithms/dfs", json={"graph_id": gid, "start": "A", "mode": "iterative"})
    assert sorted(dfs_recursive.json()["visited"]) == sorted(dfs_iterative.json()["visited"])

    invalid = client.post("/api/algorithms/bfs", json={"graph_id": gid, "start": "missing"})
    assert invalid.status_code == 422


def test_dijkstra_and_bellman_ford_endpoints(client):
    gid = build_diamond(client, "Shortest Path Graph")
    dijkstra = client.post("/api/algorithms/dijkstra", json={"graph_id": gid, "source": "A", "destination": "D"})
    assert dijkstra.status_code == 200
    assert dijkstra.json()["distance"] == 3
    assert dijkstra.json()["path"] == ["A", "B", "D"]

    bf = client.post("/api/algorithms/bellman-ford", json={"graph_id": gid, "source": "A", "destination": "D"})
    assert bf.status_code == 200
    assert bf.json()["distance"] == 3


def test_route_finder_endpoint(client):
    gid = build_diamond(client, "Route Graph")
    response = client.post(
        "/api/algorithms/route",
        json={"graph_id": gid, "source": "A", "destination": "D", "algorithm": "dijkstra"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["distance"] == 3
    assert body["reachable"] is True
    assert len(body["alternatives"]) >= 1

    same = client.post(
        "/api/algorithms/route",
        json={"graph_id": gid, "source": "A", "destination": "A", "algorithm": "dijkstra"},
    )
    assert same.status_code == 422


def test_analysis_and_connectivity_endpoints(client):
    gid = build_diamond(client, "Analysis Graph")
    analysis = client.get(f"/api/graphs/{gid}/analysis")
    assert analysis.status_code == 200
    body = analysis.json()
    assert body["node_count"] == 4
    assert body["connected"] is True
    assert body["component_count"] == 1
    assert body["average_degree"] == 2.0

    connectivity = client.post(f"/api/graphs/{gid}/connectivity", json={"source": "A"})
    assert connectivity.status_code == 200
    assert connectivity.json()["reachable_count"] == 4

    bad = client.post(f"/api/graphs/{gid}/connectivity", json={"source": "nope"})
    assert bad.status_code == 422


def test_hash_lookup_endpoint(client):
    gid = build_diamond(client, "Hash Graph")
    body = client.get(f"/api/graphs/{gid}/hash-lookup", params={"q": "A"}).json()
    assert body["found"] is True
    assert body["neighbor_count"] == 2
    assert body["node"]["metadata"] == {}
    assert len(body["buckets"]) == 8

    missing = client.get(f"/api/graphs/{gid}/hash-lookup", params={"q": "ghost"}).json()
    assert missing["found"] is False


def test_import_and_export(client):
    payload = {
        "name": "Imported Graph",
        "description": "via JSON",
        "directed": True,
        "weighted": True,
        "nodes": [{"label": "P"}, {"label": "Q"}],
        "edges": [{"source_node": "P", "target_node": "Q", "weight": 9}],
    }
    imported = client.post("/api/graphs/import", json=payload)
    assert imported.status_code == 201, imported.text
    gid = imported.json()["id"]

    exported = client.get(f"/api/graphs/{gid}/export")
    assert exported.status_code == 200
    data = json.loads(exported.text)
    assert data["directed"] is True
    assert data["edges"][0]["weight"] == 9

    bad = client.post("/api/graphs/import", json={**payload, "name": "Bad Import", "edges": [{"source_node": "P", "target_node": "Z", "weight": 1}]})
    assert bad.status_code == 400


def test_benchmark_run_and_results(client):
    response = client.post(
        "/api/benchmark/run",
        json={"sizes": [10, 30], "density": 0.2, "directed": False, "connected": True, "algorithms": ["BFS", "DFS", "Dijkstra"]},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert len(body["rows"]) == 6
    assert all(row["avg_time_ms"] >= 0 for row in body["rows"])
    assert all(row["node_count"] in (10, 30) for row in body["rows"])

    results = client.get("/api/benchmark/results")
    assert results.status_code == 200
    assert len(results.json()) >= 6


def test_samples_and_load(client):
    samples = client.get("/api/samples")
    assert samples.status_code == 200
    assert any(sample["key"] == "campus" for sample in samples.json())

    loaded = client.post("/api/samples/campus/load")
    assert loaded.status_code == 201
    assert loaded.json()["node_count"] == 7
