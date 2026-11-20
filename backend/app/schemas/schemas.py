"""Pydantic request/response models."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


# --------------------------------------------------------------------- nodes
class NodeIn(BaseModel):
    label: str = Field(min_length=1, max_length=80)
    x_position: float = 0.0
    y_position: float = 0.0
    metadata: Dict[str, Any] = Field(default_factory=dict)

    @field_validator("label")
    @classmethod
    def strip_label(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("label must not be blank")
        return cleaned


class NodeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    label: str
    x_position: float
    y_position: float
    metadata: Dict[str, Any] = Field(default_factory=dict)


class NodePatch(BaseModel):
    x_position: Optional[float] = None
    y_position: Optional[float] = None
    metadata: Optional[Dict[str, Any]] = None


# --------------------------------------------------------------------- edges
class EdgeIn(BaseModel):
    source_node: str = Field(min_length=1, max_length=80)
    target_node: str = Field(min_length=1, max_length=80)
    weight: float = 1.0


class EdgeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source_node: str
    target_node: str
    weight: float


class EdgePatch(BaseModel):
    weight: float


# -------------------------------------------------------------------- graphs
class GraphBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = ""
    directed: bool = False
    weighted: bool = True


class GraphCreate(GraphBase):
    nodes: List[NodeIn] = Field(default_factory=list)
    edges: List[EdgeIn] = Field(default_factory=list)


class GraphUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    description: Optional[str] = None
    directed: Optional[bool] = None
    weighted: Optional[bool] = None


class StructureIn(BaseModel):
    nodes: List[NodeIn]
    edges: List[EdgeIn]
    directed: Optional[bool] = None
    weighted: Optional[bool] = None


class GraphSummary(BaseModel):
    id: int
    name: str
    description: str
    directed: bool
    weighted: bool
    node_count: int
    edge_count: int
    created_at: datetime
    updated_at: datetime


class GraphDetail(BaseModel):
    id: int
    name: str
    description: str
    directed: bool
    weighted: bool
    created_at: datetime
    updated_at: datetime
    node_count: int = 0
    edge_count: int = 0
    nodes: List[NodeOut]
    edges: List[EdgeOut]


class GraphImport(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = ""
    directed: bool = False
    weighted: bool = True
    nodes: List[NodeIn] = Field(default_factory=list)
    edges: List[EdgeIn] = Field(default_factory=list)


# ---------------------------------------------------------------- algorithms
class TraversalRequest(BaseModel):
    graph_id: int
    start: str
    mode: Literal["recursive", "iterative"] = "recursive"


class ShortestPathRequest(BaseModel):
    graph_id: int
    source: str
    destination: Optional[str] = None


class RouteRequest(BaseModel):
    graph_id: int
    source: str
    destination: str
    algorithm: Literal["dijkstra", "bellman-ford"] = "dijkstra"
    include_alternatives: bool = True


class ConnectivityRequest(BaseModel):
    source: str


# ----------------------------------------------------------------- benchmark
class BenchmarkRequest(BaseModel):
    sizes: List[int] = Field(default_factory=lambda: [10, 50, 100, 500])
    density: float = Field(default=0.15, gt=0, le=1)
    directed: bool = False
    connected: bool = True
    iterations: Optional[int] = Field(default=None, ge=1, le=20)
    algorithms: List[Literal["BFS", "DFS", "Dijkstra", "Bellman-Ford"]] = Field(
        default_factory=lambda: ["BFS", "DFS", "Dijkstra", "Bellman-Ford"]
    )

    @field_validator("sizes")
    @classmethod
    def check_sizes(cls, value: List[int]) -> List[int]:
        if not value:
            raise ValueError("At least one graph size is required")
        if any(size < 1 or size > 5000 for size in value):
            raise ValueError("Graph sizes must be between 1 and 5000")
        return sorted(set(value))


class BenchmarkRow(BaseModel):
    run_id: str
    algorithm: str
    node_count: int
    edge_count: int
    graph_type: str
    directed: bool
    iterations: int
    avg_time_ms: float
    min_time_ms: float
    max_time_ms: float
    visited_nodes: int
    edge_operations: int
    memory_kb: float
    skipped_reason: str = ""


class BenchmarkResponse(BaseModel):
    run_id: str
    generated_at: datetime
    density: float
    directed: bool
    connected: bool
    generation_note: str
    rows: List[BenchmarkRow]


# ------------------------------------------------------------------ activity
class ActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    graph_id: Optional[int]
    kind: str
    message: str
    created_at: datetime
