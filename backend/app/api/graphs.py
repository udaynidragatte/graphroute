"""Graph CRUD, structure editing, import/export and sample loading."""

from __future__ import annotations

import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..algorithms.graph import Graph, GraphError
from ..database.db import get_db
from ..models.models import Edge, Graph as GraphModel, Node
from ..samples import SAMPLE_NETWORKS, sample_by_key
from ..schemas.schemas import (
    EdgeIn,
    EdgePatch,
    GraphCreate,
    GraphDetail,
    GraphImport,
    GraphSummary,
    GraphUpdate,
    NodeIn,
    NodeOut,
    NodePatch,
    StructureIn,
)
from .deps import build_graph, get_graph_or_404, graph_payload, log_activity, serialize_graph, write_structure

router = APIRouter(prefix="/api", tags=["graphs"])


def _ensure_unique_name(db: Session, name: str, exclude_id: int | None = None) -> str:
    name = name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Graph name must not be blank")
    query = select(GraphModel).where(GraphModel.name == name)
    existing = db.execute(query).scalars().first()
    if existing and existing.id != exclude_id:
        raise HTTPException(status_code=409, detail=f"A graph named '{name}' already exists")
    return name


def _unique_copy_name(db: Session, base: str) -> str:
    candidate = f"{base} copy"
    index = 2
    while db.execute(select(GraphModel).where(GraphModel.name == candidate)).scalars().first():
        candidate = f"{base} copy {index}"
        index += 1
    return candidate


def _build_from_lists(directed: bool, weighted: bool, nodes: List[NodeIn], edges: List[EdgeIn]) -> Graph:
    graph = Graph(directed=directed, weighted=weighted)
    for node in nodes:
        graph.add_node(node.label)
    for edge in edges:
        if graph.has_edge(edge.source_node, edge.target_node):
            raise GraphError(f"Duplicate edge {edge.source_node} -- {edge.target_node}")
        graph.add_edge(edge.source_node, edge.target_node, edge.weight)
    return graph


def _persist_structure(model: GraphModel, nodes: List[NodeIn], edges: List[EdgeIn]) -> None:
    write_structure(model, nodes, edges)


@router.get("/graphs", response_model=List[GraphSummary])
def list_graphs(db: Session = Depends(get_db)):
    graphs = db.execute(select(GraphModel).order_by(GraphModel.updated_at.desc())).scalars().all()
    return [serialize_graph(graph, include_structure=False) for graph in graphs]


@router.post("/graphs", response_model=GraphDetail, status_code=status.HTTP_201_CREATED)
def create_graph(payload: GraphCreate, db: Session = Depends(get_db)):
    name = _ensure_unique_name(db, payload.name)
    graph = Graph(directed=payload.directed, weighted=payload.weighted)
    for node in payload.nodes:
        graph.add_node(node.label)
    for edge in payload.edges:
        if graph.has_edge(edge.source_node, edge.target_node):
            raise HTTPException(status_code=409, detail=f"Duplicate edge {edge.source_node} -- {edge.target_node}")
        graph.add_edge(edge.source_node, edge.target_node, edge.weight)

    model = GraphModel(name=name, description=payload.description, directed=payload.directed, weighted=payload.weighted)
    db.add(model)
    db.flush()
    for node in payload.nodes:
        model.nodes.append(
            Node(
                graph_id=model.id,
                label=node.label,
                x_position=node.x_position,
                y_position=node.y_position,
                metadata_json=json.dumps(node.metadata or {}),
            )
        )
    for edge in payload.edges:
        model.edges.append(Edge(graph_id=model.id, source_node=edge.source_node, target_node=edge.target_node, weight=edge.weight))
    db.commit()
    db.refresh(model)
    log_activity(db, model.id, "graph_created", f"Graph '{model.name}' created with {len(model.nodes)} nodes")
    return graph_payload(model)


@router.post("/graphs/import", response_model=GraphDetail, status_code=status.HTTP_201_CREATED)
def import_graph(payload: GraphImport, db: Session = Depends(get_db)):
    name = _ensure_unique_name(db, payload.name)
    _build_from_lists(payload.directed, payload.weighted, payload.nodes, payload.edges)

    model = GraphModel(name=name, description=payload.description, directed=payload.directed, weighted=payload.weighted)
    db.add(model)
    db.flush()
    for node in payload.nodes:
        model.nodes.append(
            Node(
                graph_id=model.id,
                label=node.label,
                x_position=node.x_position,
                y_position=node.y_position,
                metadata_json=json.dumps(node.metadata or {}),
            )
        )
    for edge in payload.edges:
        model.edges.append(Edge(graph_id=model.id, source_node=edge.source_node, target_node=edge.target_node, weight=edge.weight))
    db.commit()
    db.refresh(model)
    log_activity(db, model.id, "graph_imported", f"Graph '{model.name}' imported from JSON")
    return graph_payload(model)


@router.get("/samples")
def list_samples(db: Session = Depends(get_db)):
    existing = {name for name in db.execute(select(GraphModel.name)).scalars().all()}
    return [
        {
            "key": sample["key"],
            "name": sample["name"],
            "description": sample["description"],
            "node_count": len(sample["nodes"]),
            "edge_count": len(sample["edges"]),
            "directed": sample["directed"],
            "weighted": sample["weighted"],
            "already_loaded": sample["name"] in existing,
        }
        for sample in SAMPLE_NETWORKS
    ]


@router.post("/samples/{key}/load", response_model=GraphDetail, status_code=status.HTTP_201_CREATED)
def load_sample(key: str, db: Session = Depends(get_db)):
    sample = sample_by_key(key)
    if sample is None:
        raise HTTPException(status_code=404, detail=f"Sample '{key}' not found")

    base_name = sample["name"]
    name = base_name
    index = 2
    while db.execute(select(GraphModel).where(GraphModel.name == name)).scalars().first():
        name = f"{base_name} ({index})"
        index += 1

    model = GraphModel(
        name=name,
        description=sample["description"],
        directed=sample["directed"],
        weighted=sample["weighted"],
    )
    db.add(model)
    db.flush()
    for node in sample["nodes"]:
        model.nodes.append(
            Node(
                graph_id=model.id,
                label=node["label"],
                x_position=node.get("x_position", 0),
                y_position=node.get("y_position", 0),
                metadata_json=json.dumps(node.get("metadata", {})),
            )
        )
    for source, target, weight in sample["edges"]:
        model.edges.append(Edge(graph_id=model.id, source_node=source, target_node=target, weight=weight))
    db.commit()
    db.refresh(model)
    log_activity(db, model.id, "graph_imported", f"Sample network '{name}' loaded")
    return graph_payload(model)


@router.get("/graphs/{graph_id}", response_model=GraphDetail)
def get_graph(graph_id: int, db: Session = Depends(get_db)):
    return graph_payload(get_graph_or_404(db, graph_id))


@router.put("/graphs/{graph_id}", response_model=GraphDetail)
def update_graph(graph_id: int, payload: GraphUpdate, db: Session = Depends(get_db)):
    model = get_graph_or_404(db, graph_id)
    if payload.name is not None:
        model.name = _ensure_unique_name(db, payload.name, exclude_id=model.id)
    if payload.description is not None:
        model.description = payload.description
    if payload.weighted is not None and payload.weighted != model.weighted:
        model.weighted = payload.weighted
        if not payload.weighted:
            for edge in model.edges:
                edge.weight = 1.0
    if payload.directed is not None and payload.directed != model.directed:
        # Rebuild edges so the adjacency stays consistent for the new mode.
        current = build_graph(model)
        model.directed = payload.directed
        graph = Graph(directed=payload.directed, weighted=model.weighted)
        for node in current.get_nodes():
            graph.add_node(node)
        for source, target, weight in current.get_edges():
            if graph.has_edge(source, target):
                continue
            graph.add_edge(source, target, weight)
        model.edges.clear()
        for source, target, weight in graph.get_edges():
            model.edges.append(Edge(graph_id=model.id, source_node=source, target_node=target, weight=weight))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Graph name must be unique")
    db.refresh(model)
    log_activity(db, model.id, "graph_updated", f"Graph '{model.name}' updated")
    return graph_payload(model)


@router.put("/graphs/{graph_id}/structure", response_model=GraphDetail)
def replace_structure(graph_id: int, payload: StructureIn, db: Session = Depends(get_db)):
    model = get_graph_or_404(db, graph_id)
    if payload.directed is not None:
        model.directed = payload.directed
    if payload.weighted is not None:
        model.weighted = payload.weighted
    _persist_structure(model, payload.nodes, payload.edges)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Could not save graph structure")
    db.refresh(model)
    log_activity(db, model.id, "graph_updated", f"Structure of '{model.name}' saved ({len(model.nodes)} nodes, {len(model.edges)} edges)")
    return graph_payload(model)


@router.delete("/graphs/{graph_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_graph(graph_id: int, db: Session = Depends(get_db)):
    model = get_graph_or_404(db, graph_id)
    name = model.name
    db.delete(model)
    db.commit()
    log_activity(db, None, "graph_deleted", f"Graph '{name}' deleted")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/graphs/{graph_id}/duplicate", response_model=GraphDetail, status_code=status.HTTP_201_CREATED)
def duplicate_graph(graph_id: int, db: Session = Depends(get_db)):
    model = get_graph_or_404(db, graph_id)
    clone = GraphModel(
        name=_unique_copy_name(db, model.name),
        description=model.description,
        directed=model.directed,
        weighted=model.weighted,
    )
    db.add(clone)
    db.flush()
    for node in model.nodes:
        clone.nodes.append(
            Node(
                graph_id=clone.id,
                label=node.label,
                x_position=node.x_position,
                y_position=node.y_position,
                metadata_json=node.metadata_json,
            )
        )
    for edge in model.edges:
        clone.edges.append(Edge(graph_id=clone.id, source_node=edge.source_node, target_node=edge.target_node, weight=edge.weight))
    db.commit()
    db.refresh(clone)
    log_activity(db, clone.id, "graph_created", f"Graph '{model.name}' duplicated as '{clone.name}'")
    return graph_payload(clone)


@router.post("/graphs/{graph_id}/reset", response_model=GraphDetail)
def reset_graph(graph_id: int, db: Session = Depends(get_db)):
    model = get_graph_or_404(db, graph_id)
    model.nodes.clear()
    model.edges.clear()
    db.commit()
    db.refresh(model)
    log_activity(db, model.id, "graph_reset", f"Graph '{model.name}' was reset to an empty network")
    return graph_payload(model)


@router.get("/graphs/{graph_id}/export")
def export_graph(graph_id: int, db: Session = Depends(get_db)):
    model = get_graph_or_404(db, graph_id)
    payload = graph_payload(model)
    payload["nodes"] = [
        {
            "label": node["label"],
            "x_position": node["x_position"],
            "y_position": node["y_position"],
            "metadata": node["metadata"],
        }
        for node in payload["nodes"]
    ]
    payload["edges"] = [
        {"source_node": edge["source_node"], "target_node": edge["target_node"], "weight": edge["weight"]}
        for edge in payload["edges"]
    ]
    return Response(
        content=json.dumps(payload, indent=2, default=str),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{model.name}.json"'},
    )


# ----------------------------------------------------------------------- nodes
@router.post("/graphs/{graph_id}/nodes", response_model=GraphDetail, status_code=status.HTTP_201_CREATED)
def add_node(graph_id: int, payload: NodeIn, db: Session = Depends(get_db)):
    model = get_graph_or_404(db, graph_id)
    graph = build_graph(model)
    try:
        graph.add_node(payload.label)
    except GraphError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    model.nodes.append(
        Node(
            graph_id=model.id,
            label=payload.label,
            x_position=payload.x_position,
            y_position=payload.y_position,
            metadata_json=json.dumps(payload.metadata or {}),
        )
    )
    db.commit()
    db.refresh(model)
    log_activity(db, model.id, "node_added", f"Node '{payload.label}' added to '{model.name}'")
    return graph_payload(model)


@router.patch("/graphs/{graph_id}/nodes/{label}", response_model=GraphDetail)
def patch_node(graph_id: int, label: str, payload: NodePatch, db: Session = Depends(get_db)):
    model = get_graph_or_404(db, graph_id)
    node = next((n for n in model.nodes if n.label == label), None)
    if node is None:
        raise HTTPException(status_code=404, detail=f"Node '{label}' not found")
    if payload.x_position is not None:
        node.x_position = payload.x_position
    if payload.y_position is not None:
        node.y_position = payload.y_position
    if payload.metadata is not None:
        node.metadata_json = json.dumps(payload.metadata)
    db.commit()
    db.refresh(model)
    return graph_payload(model)


@router.delete("/graphs/{graph_id}/nodes/{label}", response_model=GraphDetail)
def delete_node(graph_id: int, label: str, db: Session = Depends(get_db)):
    model = get_graph_or_404(db, graph_id)
    node = next((n for n in model.nodes if n.label == label), None)
    if node is None:
        raise HTTPException(status_code=404, detail=f"Node '{label}' not found")
    model.nodes.remove(node)
    removed = [edge for edge in model.edges if label in (edge.source_node, edge.target_node)]
    for edge in removed:
        model.edges.remove(edge)
    db.commit()
    db.refresh(model)
    log_activity(db, model.id, "node_deleted", f"Node '{label}' and {len(removed)} incident edges deleted")
    return graph_payload(model)


# ----------------------------------------------------------------------- edges
@router.post("/graphs/{graph_id}/edges", response_model=GraphDetail, status_code=status.HTTP_201_CREATED)
def add_edge(graph_id: int, payload: EdgeIn, db: Session = Depends(get_db)):
    model = get_graph_or_404(db, graph_id)
    graph = build_graph(model)
    try:
        graph.add_edge(payload.source_node, payload.target_node, payload.weight)
    except GraphError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    model.edges.append(
        Edge(graph_id=model.id, source_node=payload.source_node, target_node=payload.target_node, weight=payload.weight)
    )
    db.commit()
    db.refresh(model)
    log_activity(db, model.id, "edge_added", f"Edge {payload.source_node} → {payload.target_node} added (weight {payload.weight:g})")
    return graph_payload(model)


@router.patch("/graphs/{graph_id}/edges/{edge_id}", response_model=GraphDetail)
def update_edge(graph_id: int, edge_id: int, payload: EdgePatch, db: Session = Depends(get_db)):
    model = get_graph_or_404(db, graph_id)
    edge = next((e for e in model.edges if e.id == edge_id), None)
    if edge is None:
        raise HTTPException(status_code=404, detail=f"Edge {edge_id} not found")
    try:
        Graph._validate_weight(payload.weight)
    except GraphError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    edge.weight = float(payload.weight)
    db.commit()
    db.refresh(model)
    log_activity(db, model.id, "edge_updated", f"Edge {edge.source_node} → {edge.target_node} weight set to {payload.weight:g}")
    return graph_payload(model)


@router.delete("/graphs/{graph_id}/edges", response_model=GraphDetail)
def delete_edge(graph_id: int, source_node: str, target_node: str, db: Session = Depends(get_db)):
    model = get_graph_or_404(db, graph_id)
    edge = next(
        (
            e
            for e in model.edges
            if (e.source_node == source_node and e.target_node == target_node)
            or (not model.directed and e.source_node == target_node and e.target_node == source_node)
        ),
        None,
    )
    if edge is None:
        raise HTTPException(status_code=404, detail=f"Edge {source_node} → {target_node} not found")
    model.edges.remove(edge)
    db.commit()
    db.refresh(model)
    log_activity(db, model.id, "edge_deleted", f"Edge {source_node} → {target_node} deleted")
    return graph_payload(model)
