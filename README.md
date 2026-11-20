# GraphRoute — Graph-Based Route Optimization & Network Analysis

A full-stack DSA project (5th semester CSE) that demonstrates graph data structures, traversal, shortest paths and network analysis on real, user-editable graphs. Nothing in the algorithm results is hardcoded: every number comes from the Python implementations in `backend/app/algorithms/`.

![Dashboard placeholder](docs/screenshots/dashboard.png)
![Visualizer placeholder](docs/screenshots/visualizer.png)
![Route Finder placeholder](docs/screenshots/route-finder.png)
> Screenshot placeholders — add your own captures to `docs/screenshots/` before submitting the report.

---

## 1. Project overview

GraphRoute is a network-monitoring style dashboard where you can build a weighted graph (sample or custom), route between two nodes with Dijkstra or Bellman-Ford, animate BFS/DFS, inspect connectivity, explore hash-based lookups and benchmark the algorithms up to 5000 nodes.

## 2. Problem statement

Given a network of locations (campus paths, cities, routers) connected by weighted links, answer questions such as:

- What is the cheapest route from A to B?
- Which nodes are unreachable if a link fails?
- How dense/connected is the network?
- How do BFS, DFS, Dijkstra and Bellman-Ford scale as the graph grows?

## 3. Objectives

1. Implement an adjacency-list graph with full CRUD and validation.
2. Implement BFS, DFS, Dijkstra and Bellman-Ford by hand (no NetworkX calls).
3. Persist graphs in SQLite through SQLAlchemy.
4. Expose a validated REST API with FastAPI.
5. Visualise and animate traversal/relaxation on an interactive canvas.
6. Measure real execution time/memory and explain time/space complexity.

## 4. Features

| Area | What it does |
|---|---|
| Overview | Live node/edge/density/component stats, graph preview, activity feed, health panel |
| Graph Visualizer | Click-to-add nodes, drag to move, create/delete edges, edit weights, undo/redo, 4 layouts, directed/weighted toggles, JSON import/export |
| Route Finder | Dijkstra/Bellman-Ford, optimal path highlight, alternative simple paths, algorithm comparison table |
| Traversal Explorer | BFS, recursive DFS, iterative DFS with play/pause/next/previous/restart/speed and queue/stack logs |
| Network Analysis | Density, degree distribution chart, components, isolates, cycle detection, weak/strong connectivity, reachability map |
| Hashing Explorer | O(1) node lookup demo, bucket visualisation, adjacency table, built-in dict vs custom hash distinction |
| Benchmark | Configurable graph sizes/types/density, warm-up + N iterations, bar/line charts, CSV export, stored runs |
| Graph Management | Create/rename/duplicate/delete/reset/import/export graphs; load 3 sample networks |
| Settings | Animation speed, canvas height, weight visibility, backend health check |

## 5. Architecture

```
React (Vite + TS + Tailwind + React Flow + Recharts)
        │  axios  /api  (Vite proxy → 127.0.0.1:8000)
        ▼
FastAPI routers (graphs, algorithms, analysis, benchmark)
        │
        ├── algorithms/  graph.py · bfs.py · dfs.py · dijkstra.py · bellman_ford.py · routes.py
        ├── analysis/    analysis.py (density, components, cycles, connectivity) · generators.py
        ├── models/      SQLAlchemy ORM
        └── database/    SQLite engine + sessions
```

## 6. Tech stack

- **Frontend:** React 18, Vite 5, TypeScript, Tailwind CSS 3, React Flow (`@xyflow/react`), Recharts, Lucide React, Axios, React Router.
- **Backend:** Python 3.11+, FastAPI, Pydantic v2, SQLAlchemy 2, SQLite, Uvicorn, pytest.
- **No NetworkX dependency:** all four algorithms are hand-written so they can be defended in a viva.

## 7. Graph representation

An adjacency list implemented as a dictionary of dictionaries:

```json
{
  "A": { "B": 5, "C": 2 },
  "B": { "A": 5, "D": 3 },
  "C": { "A": 2, "D": 7 },
  "D": { "B": 3, "C": 7 }
}
```

- Undirected edges are stored in both directions.
- Directed edges store one direction only.
- Weight updates stay in sync for both directions of an undirected edge.
- Duplicate nodes, duplicate edges, blank ids, non-numeric/NaN weights, self-loops and edges to missing nodes are rejected (`GraphError` → HTTP 400/409/422).
- Node lookup and edge-existence checks are **average O(1)** because they hit a hash table.

`Graph` API: `add_node`, `remove_node`, `add_edge`, `remove_edge`, `update_edge_weight`, `get_neighbors`, `get_nodes`, `get_edges`, `graph_exists`, `get_degree`, `clear_graph`.

## 8. Algorithm explanations (viva notes)

**BFS** — queue of nodes, mark visited on enqueue, record parent + level. Time O(V+E), space O(V). Answers "fewest hops" and reachability.

**DFS** — recursive version (call stack) and iterative version (explicit stack of `(node, neighbour iterator)` frames). Time O(V+E), space O(V). Used for cycle detection and connected components.

**Dijkstra** — min-heap (`heapq`) of `(distance, node)`; skip stale entries; relax each outgoing edge once settled. Refuses negative weights because a settled node could later be improved. Time O((V+E) log V), space O(V+E).

**Bellman-Ford** — relax *all* edges V−1 times; early-exit if a pass makes no change. One extra pass detects a negative cycle by walking parent pointers. Time O(V·E), space O(V). Handles negative weights.

**Choosing:** non-negative weights → Dijkstra (faster). Any negative weight or a need to detect negative cycles → Bellman-Ford.

**Alternative routes** — a bounded DFS enumerates distinct simple paths; only the Dijkstra/Bellman-Ford result is guaranteed optimal, and the UI labels this explicitly.

## 9. Complexity table

| Algorithm | Time | Space | Notes |
|---|---|---|---|
| Graph add/lookup node | O(1) avg | O(V+E) | Python dict |
| BFS | O(V + E) | O(V) | queue |
| DFS | O(V + E) | O(V) | recursion / stack |
| Dijkstra | O((V + E) log V) | O(V + E) | binary heap |
| Bellman-Ford | O(V · E) | O(V) | V−1 passes + cycle check |
| Connected components | O(V + E) | O(V) | DFS over undirected view |
| Strong components | O(V + E) | O(V) | Kosaraju |
| Density | O(1) | O(1) | `2E/(V(V−1))` undirected, `E/(V(V−1))` directed |

## 10. Installation & running (Windows)

```bat
:: Backend
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

```bat
:: Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — API docs at http://127.0.0.1:8000/docs.

The SQLite file `backend/graphs.db` and the three sample networks plus an empty "Custom Graph" are created automatically on first startup.

### Tests

```bat
cd backend
venv\Scripts\activate
pytest -q
```

57 tests cover graph validation, all algorithms, negative cycles, components, density, connectivity and every API group.

## 11. API documentation

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | service + DB status |
| GET/POST | `/api/graphs` | list / create graphs |
| GET/PUT/DELETE | `/api/graphs/{id}` | read / rename / delete |
| PUT | `/api/graphs/{id}/structure` | replace nodes+edges (undo/redo, layouts) |
| POST | `/api/graphs/{id}/duplicate` | clone |
| POST | `/api/graphs/{id}/reset` | clear nodes+edges |
| GET | `/api/graphs/{id}/export` | JSON download |
| POST | `/api/graphs/import` | create from JSON |
| POST | `/api/graphs/{id}/nodes` | add node |
| PATCH/DELETE | `/api/graphs/{id}/nodes/{label}` | move/metadata, delete (cascades edges) |
| POST | `/api/graphs/{id}/edges` | add edge |
| PATCH/DELETE | `/api/graphs/{id}/edges[/{edge_id}]` | weight update, delete |
| GET | `/api/graphs/{id}/analysis` | full metrics |
| POST | `/api/graphs/{id}/connectivity` | reachability from a source |
| GET | `/api/graphs/{id}/hash-lookup?q=` | hashing demo |
| POST | `/api/algorithms/bfs` | `{graph_id, start}` |
| POST | `/api/algorithms/dfs` | `{graph_id, start, mode}` |
| POST | `/api/algorithms/dijkstra` | `{graph_id, source, destination?}` |
| POST | `/api/algorithms/bellman-ford` | same |
| POST | `/api/algorithms/route` | route + alternatives |
| POST | `/api/benchmark/run` | generate + measure |
| GET/DELETE | `/api/benchmark/results` | stored runs / clear |
| GET | `/api/activities` | recent activity |
| GET/POST | `/api/samples`, `/api/samples/{key}/load` | sample networks |

All invalid inputs return 4xx with `{"detail": ...}`; the frontend surfaces these as toasts.

## 12. Sample graphs

1. **College Campus** — 7 nodes (Main Gate, Library, Canteen, Block A/B, Auditorium, Parking), distances in metres (demo data).
2. **City Transport** — 7 Karnataka cities, approximate road distances in km (demo data).
3. **Computer Network** — router/firewall/server/switches/clients, demo latency in ms.
4. **Custom Graph** — empty, ready to build.

Distances and latencies are explicitly demo values, not real measurements.

## 13. Benchmark methodology

- Graph generated per size with a fixed seed (`density × possible edges`, spanning tree when "connected").
- Generation time measured separately and **excluded** from algorithm timings.
- One warm-up run per algorithm is discarded; then `iterations = 5` (≤100 nodes), `3` (≤500) or `1` (larger) unless overridden.
- Mean/min/max from `time.perf_counter`; peak memory from `tracemalloc`.
- Sub-millisecond timings are labelled approximate. Bellman-Ford above 1500 nodes is **skipped and marked**, never fabricated.
- Edge count is capped at 120k so dense 5000-node runs stay interactive.

## 14. Limitations

- Single-user local app; no authentication.
- Randomised benchmark graphs use uniform density, not real-world distributions.
- Alternative-path enumeration is bounded and not the k-shortest-paths algorithm.
- Python timing includes interpreter overhead; absolute numbers vary by machine.
- Sample coordinates/distances are illustrative only.

## 15. Future enhancements

- A* and k-shortest-paths (Yen's algorithm).
- Multi-user accounts and shared graphs.
- Live traffic updates that re-run Dijkstra incrementally.
- Import from OpenStreetMap for real road networks.
- WebSocket streaming of traversal steps for very large graphs.
