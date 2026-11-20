"""FastAPI application entry point.

Run with:  uvicorn app.main:app --reload
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import func, select

from .algorithms.graph import GraphError
from .api import algorithms, analysis, benchmark, graphs
from .database.db import SessionLocal, engine, init_db
from .models.models import Graph, Node
from .seed import seed_if_empty

VERSION = "1.0.0"


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    if os.getenv("SKIP_SEED") != "1":
        db = SessionLocal()
        try:
            seed_if_empty(db)
        finally:
            db.close()
    yield


app = FastAPI(
    title="Graph Route Optimization API",
    description="DSA project API: adjacency-list graphs, BFS/DFS, Dijkstra, Bellman-Ford, analysis and benchmarks.",
    version=VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(GraphError)
async def graph_error_handler(request: Request, exc: GraphError):
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.get("/")
def root():
    return {
        "name": "Graph Route Optimization API",
        "version": VERSION,
        "docs": "/docs",
        "health": "/api/health",
    }


@app.get("/api/health")
def health():
    with engine.connect() as connection:
        connection.exec_driver_sql("SELECT 1")
    db = SessionLocal()
    try:
        graph_count = db.execute(select(func.count(Graph.id))).scalar() or 0
        node_count = db.execute(select(func.count(Node.id))).scalar() or 0
    finally:
        db.close()
    return {"status": "ok", "version": VERSION, "graphs": graph_count, "nodes": node_count}


app.include_router(graphs.router)
app.include_router(algorithms.router)
app.include_router(analysis.router)
app.include_router(benchmark.router)
