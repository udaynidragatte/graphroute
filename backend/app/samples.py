"""Sample networks loaded on first startup.

Distances/latencies are demo data for a college project, not real measurements.
"""

from __future__ import annotations

from typing import Any, Dict, List

SAMPLE_NETWORKS: List[Dict[str, Any]] = [
    {
        "key": "campus",
        "name": "College Campus",
        "description": "Walking paths around a college campus. Weights are demo distances in metres.",
        "directed": False,
        "weighted": True,
        "nodes": [
            {"label": "Main Gate", "x_position": 80, "y_position": 260, "metadata": {"type": "entrance"}},
            {"label": "Library", "x_position": 280, "y_position": 100, "metadata": {"type": "academic"}},
            {"label": "Canteen", "x_position": 280, "y_position": 420, "metadata": {"type": "food"}},
            {"label": "Block A", "x_position": 500, "y_position": 120, "metadata": {"type": "academic"}},
            {"label": "Block B", "x_position": 500, "y_position": 400, "metadata": {"type": "academic"}},
            {"label": "Auditorium", "x_position": 700, "y_position": 240, "metadata": {"type": "event"}},
            {"label": "Parking", "x_position": 90, "y_position": 60, "metadata": {"type": "utility"}},
        ],
        "edges": [
            ("Main Gate", "Library", 120),
            ("Main Gate", "Canteen", 150),
            ("Main Gate", "Parking", 60),
            ("Library", "Block A", 90),
            ("Library", "Block B", 190),
            ("Canteen", "Block A", 140),
            ("Canteen", "Block B", 110),
            ("Block A", "Auditorium", 80),
            ("Block B", "Auditorium", 70),
            ("Parking", "Block B", 210),
        ],
    },
    {
        "key": "city",
        "name": "City Transport",
        "description": "Karnataka city routes with approximate demo road distances in km.",
        "directed": False,
        "weighted": True,
        "nodes": [
            {"label": "Mysuru", "x_position": 110, "y_position": 330, "metadata": {"type": "city"}},
            {"label": "Bengaluru", "x_position": 740, "y_position": 230, "metadata": {"type": "city"}},
            {"label": "Tumakuru", "x_position": 560, "y_position": 130, "metadata": {"type": "city"}},
            {"label": "Chitradurga", "x_position": 520, "y_position": 380, "metadata": {"type": "city"}},
            {"label": "Davanagere", "x_position": 350, "y_position": 470, "metadata": {"type": "city"}},
            {"label": "Shivamogga", "x_position": 150, "y_position": 520, "metadata": {"type": "city"}},
            {"label": "Hassan", "x_position": 200, "y_position": 170, "metadata": {"type": "city"}},
        ],
        "edges": [
            ("Mysuru", "Bengaluru", 145),
            ("Mysuru", "Hassan", 120),
            ("Mysuru", "Shivamogga", 190),
            ("Hassan", "Tumakuru", 180),
            ("Hassan", "Shivamogga", 175),
            ("Tumakuru", "Bengaluru", 70),
            ("Tumakuru", "Chitradurga", 130),
            ("Bengaluru", "Chitradurga", 200),
            ("Chitradurga", "Davanagere", 75),
            ("Davanagere", "Shivamogga", 90),
        ],
    },
    {
        "key": "network",
        "name": "Computer Network",
        "description": "Small office network topology. Weights are demo latency in milliseconds.",
        "directed": False,
        "weighted": True,
        "nodes": [
            {"label": "Router", "x_position": 420, "y_position": 80, "metadata": {"type": "network", "ip": "10.0.0.1"}},
            {"label": "Firewall", "x_position": 180, "y_position": 200, "metadata": {"type": "security"}},
            {"label": "Server", "x_position": 680, "y_position": 200, "metadata": {"type": "server"}},
            {"label": "Switch 1", "x_position": 320, "y_position": 350, "metadata": {"type": "switch"}},
            {"label": "Switch 2", "x_position": 560, "y_position": 350, "metadata": {"type": "switch"}},
            {"label": "Client 1", "x_position": 200, "y_position": 480, "metadata": {"type": "client"}},
            {"label": "Client 2", "x_position": 680, "y_position": 480, "metadata": {"type": "client"}},
        ],
        "edges": [
            ("Firewall", "Router", 2),
            ("Firewall", "Server", 8),
            ("Router", "Server", 3),
            ("Router", "Switch 1", 1),
            ("Router", "Switch 2", 1),
            ("Switch 1", "Client 1", 5),
            ("Switch 2", "Client 2", 4),
            ("Server", "Switch 2", 2),
            ("Firewall", "Switch 1", 6),
        ],
    },
]


def sample_by_key(key: str) -> Dict[str, Any] | None:
    for sample in SAMPLE_NETWORKS:
        if sample["key"] == key:
            return sample
    return None
