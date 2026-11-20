"""SQLAlchemy ORM models."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database.db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Graph(Base):
    __tablename__ = "graphs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    directed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    weighted: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    nodes: Mapped[List["Node"]] = relationship(
        back_populates="graph", cascade="all, delete-orphan", order_by="Node.id", lazy="selectin"
    )
    edges: Mapped[List["Edge"]] = relationship(
        back_populates="graph", cascade="all, delete-orphan", order_by="Edge.id", lazy="selectin"
    )


class Node(Base):
    __tablename__ = "nodes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    graph_id: Mapped[int] = mapped_column(ForeignKey("graphs.id", ondelete="CASCADE"), index=True, nullable=False)
    label: Mapped[str] = mapped_column(String(80), nullable=False)
    x_position: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    y_position: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    metadata_json: Mapped[str] = mapped_column(Text, default="{}", nullable=False)

    graph: Mapped["Graph"] = relationship(back_populates="nodes")


class Edge(Base):
    __tablename__ = "edges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    graph_id: Mapped[int] = mapped_column(ForeignKey("graphs.id", ondelete="CASCADE"), index=True, nullable=False)
    source_node: Mapped[str] = mapped_column(String(80), nullable=False)
    target_node: Mapped[str] = mapped_column(String(80), nullable=False)
    weight: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)

    graph: Mapped["Graph"] = relationship(back_populates="edges")


class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    graph_id: Mapped[int | None] = mapped_column(ForeignKey("graphs.id", ondelete="CASCADE"), nullable=True)
    kind: Mapped[str] = mapped_column(String(40), nullable=False)
    message: Mapped[str] = mapped_column(String(400), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


class BenchmarkResult(Base):
    __tablename__ = "benchmark_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    run_id: Mapped[str] = mapped_column(String(40), index=True, nullable=False)
    algorithm: Mapped[str] = mapped_column(String(40), nullable=False)
    node_count: Mapped[int] = mapped_column(Integer, nullable=False)
    edge_count: Mapped[int] = mapped_column(Integer, nullable=False)
    graph_type: Mapped[str] = mapped_column(String(40), default="connected", nullable=False)
    directed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    iterations: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    avg_time_ms: Mapped[float] = mapped_column(Float, nullable=False)
    min_time_ms: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    max_time_ms: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    visited_nodes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    edge_operations: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    memory_kb: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    skipped_reason: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
