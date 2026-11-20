"""Shared helpers for API routers."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..algorithms.graph import Graph, GraphError
from ..models.models import Activity, Edge, Graph as GraphModel, Node


def get_graph_or_404(db: Session, graph_id: int) -> GraphModel:
    graph = db.get(GraphModel, graph_id)
    if graph is None:
        raise HTTPException(status_code=404, detail=f"Graph {graph_id} not found")
    return graph


def build_graph(model: GraphModel) -> Graph:
    graph = Graph(directed=model.directed, weighted=model.weighted)
    for node in model.nodes:
        graph.add_node(node.label)
    for edge in model.edges:
        if graph.has_edge(edge.source_node, edge.target_node):
            continue
        graph.add_edge(edge.source_node, edge.target_node, edge.weight)
    return graph


def serialize_node(node: Node) -> Dict[str, Any]:
    import json

    try:
        metadata = json.loads(node.metadata_json or "{}")
        if not isinstance(metadata, dict):
            metadata = {}
    except (ValueError, TypeError):
        metadata = {}
    return {
        "id": node.id,
        "label": node.label,
        "x_position": node.x_position,
        "y_position": node.y_position,
        "metadata": metadata,
    }


def serialize_graph(model: GraphModel, include_structure: bool = True) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "id": model.id,
        "name": model.name,
        "description": model.description,
        "directed": model.directed,
        "weighted": model.weighted,
        "created_at": model.created_at,
        "updated_at": model.updated_at,
        "node_count": len(model.nodes),
        "edge_count": len(model.edges),
    }
    if include_structure:
        payload["nodes"] = [serialize_node(node) for node in model.nodes]
        payload["edges"] = [
            {"id": edge.id, "source_node": edge.source_node, "target_node": edge.target_node, "weight": edge.weight}
            for edge in model.edges
        ]
    return payload


def graph_payload(model: GraphModel) -> Dict[str, Any]:
    return serialize_graph(model, include_structure=True)


def log_activity(db: Session, graph_id: int | None, kind: str, message: str) -> None:
    db.add(Activity(graph_id=graph_id, kind=kind, message=message, created_at=datetime.now(timezone.utc)))
    db.commit()


def write_structure(model: GraphModel, nodes: List[Any], edges: List[Any]) -> None:
    """Validate a complete nodes+edges snapshot and store it, preserving positions."""
    graph = Graph(directed=model.directed, weighted=model.weighted)
    positions: Dict[str, Dict[str, float]] = {}
    metadata: Dict[str, Dict[str, Any]] = {}

    for node in nodes:
        graph.add_node(node.label)
        positions[node.label] = {"x_position": node.x_position, "y_position": node.y_position}
        metadata[node.label] = node.metadata or {}

    for edge in edges:
        if graph.has_edge(edge.source_node, edge.target_node):
            raise GraphError(f"Duplicate edge {edge.source_node} -- {edge.target_node}")
        graph.add_edge(edge.source_node, edge.target_node, edge.weight)

    model.nodes.clear()
    model.edges.clear()
    for label in graph.get_nodes():
        model.nodes.append(
            Node(
                graph_id=model.id,
                label=label,
                x_position=positions[label]["x_position"],
                y_position=positions[label]["y_position"],
                metadata_json=__import__("json").dumps(metadata[label]),
            )
        )
    for source, target, weight in graph.get_edges():
        model.edges.append(Edge(graph_id=model.id, source_node=source, target_node=target, weight=weight))

