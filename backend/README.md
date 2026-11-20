# GraphRoute Backend

FastAPI + SQLAlchemy + SQLite service for graph storage, algorithms, analysis and benchmarks.

## Run

```bat
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

- API docs: http://127.0.0.1:8000/docs
- Health: http://127.0.0.1:8000/api/health
- Database: `backend/graphs.db` (created automatically, seeded on first run)

## Test

```bat
pytest -q
```

Tests use a separate `test_graph_routes.db` file which is recreated on each run.

## Layout

```
app/
  main.py              FastAPI app, CORS, lifespan seeding, health
  api/                 graphs.py, algorithms.py, analysis.py, benchmark.py, deps.py
  algorithms/          graph.py, bfs.py, dfs.py, dijkstra.py, bellman_ford.py, routes.py
  analysis/            analysis.py, generators.py
  database/            db.py (engine, session, Base)
  models/              SQLAlchemy models
  schemas/             Pydantic request/response models
  samples.py           three seeded sample networks
  seed.py              first-run seeding
tests/                 test_algorithms.py, test_api.py
```

## Notes

- `POST /api/algorithms/bfs` takes `{"graph_id": 1, "start": "A"}`.
- Dijkstra returns 422 for negative weights; Bellman-Ford reports `has_negative_cycle`.
- All algorithm results are computed per request from the stored adjacency list.
- `PUT /api/graphs/{id}/structure` validates the whole snapshot before replacing anything, which is what undo/redo and layouts use.
