"""First-run seeding: three sample networks plus an empty custom graph."""

from __future__ import annotations

import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models.models import Edge, Graph, Node
from .samples import SAMPLE_NETWORKS


def seed_if_empty(db: Session) -> int:
    existing = db.execute(select(Graph.id)).first()
    if existing is not None:
        return 0

    created = 0
    for sample in SAMPLE_NETWORKS:
        graph = Graph(
            name=sample["name"],
            description=sample["description"],
            directed=sample["directed"],
            weighted=sample["weighted"],
        )
        db.add(graph)
        db.flush()
        for node in sample["nodes"]:
            db.add(
                Node(
                    graph_id=graph.id,
                    label=node["label"],
                    x_position=node.get("x_position", 0),
                    y_position=node.get("y_position", 0),
                    metadata_json=json.dumps(node.get("metadata", {})),
                )
            )
        for source, target, weight in sample["edges"]:
            db.add(Edge(graph_id=graph.id, source_node=source, target_node=target, weight=weight))
        created += 1

    db.add(
        Graph(
            name="Custom Graph",
            description="Your own network. Add nodes on the canvas to start building.",
            directed=False,
            weighted=True,
        )
    )
    db.commit()
    return created + 1
