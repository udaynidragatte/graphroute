export type LayoutKind = 'force' | 'circular' | 'grid' | 'hierarchical';

export interface LayoutNode {
  label: string;
}

export interface LayoutEdge {
  source_node: string;
  target_node: string;
}

export type Positions = Record<string, { x: number; y: number }>;

const WIDTH = 1000;
const HEIGHT = 620;

export function computeLayout(kind: LayoutKind, nodes: LayoutNode[], edges: LayoutEdge[]): Positions {
  if (nodes.length === 0) return {};
  switch (kind) {
    case 'circular':
      return circular(nodes);
    case 'grid':
      return grid(nodes);
    case 'hierarchical':
      return hierarchical(nodes, edges);
    case 'force':
    default:
      return forceDirected(nodes, edges);
  }
}

function circular(nodes: LayoutNode[]): Positions {
  const radius = Math.min(WIDTH, HEIGHT) / 2 - 70;
  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;
  const positions: Positions = {};
  nodes.forEach((node, index) => {
    const angle = (2 * Math.PI * index) / nodes.length - Math.PI / 2;
    positions[node.label] = {
      x: cx + radius * Math.cos(angle) - 45,
      y: cy + radius * Math.sin(angle) - 20,
    };
  });
  return positions;
}

function grid(nodes: LayoutNode[]): Positions {
  const columns = Math.ceil(Math.sqrt(nodes.length));
  const rows = Math.ceil(nodes.length / columns);
  const gapX = Math.min(190, (WIDTH - 100) / Math.max(columns, 1));
  const gapY = Math.min(150, (HEIGHT - 80) / Math.max(rows, 1));
  const positions: Positions = {};
  nodes.forEach((node, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    positions[node.label] = {
      x: 70 + column * gapX + (WIDTH - 100 - columns * gapX) / 2,
      y: 60 + row * gapY,
    };
  });
  return positions;
}

function hierarchical(nodes: LayoutNode[], edges: LayoutEdge[]): Positions {
  const adjacency: Record<string, Set<string>> = {};
  nodes.forEach((node) => {
    adjacency[node.label] = new Set();
  });
  edges.forEach((edge) => {
    adjacency[edge.source_node]?.add(edge.target_node);
    adjacency[edge.target_node]?.add(edge.source_node);
  });

  // Root = highest degree node (falls back to the first node).
  const root = [...nodes].sort((a, b) => adjacency[b.label].size - adjacency[a.label].size)[0].label;
  const layer: Record<string, number> = { [root]: 0 };
  const queue: string[] = [root];
  while (queue.length) {
    const current = queue.shift() as string;
    for (const neighbour of adjacency[current] ?? []) {
      if (layer[neighbour] === undefined) {
        layer[neighbour] = layer[current] + 1;
        queue.push(neighbour);
      }
    }
  }
  const unvisited = nodes.filter((node) => layer[node.label] === undefined);
  let maxLayer = Math.max(0, ...Object.values(layer));
  unvisited.forEach((node) => {
    maxLayer += 1;
    layer[node.label] = maxLayer;
  });

  const groups: Record<number, string[]> = {};
  nodes.forEach((node) => {
    const depth = layer[node.label] ?? 0;
    groups[depth] = groups[depth] ?? [];
    groups[depth].push(node.label);
  });

  const positions: Positions = {};
  const depthCount = Math.max(...Object.keys(groups).map(Number)) + 1;
  const gapY = Math.min(150, (HEIGHT - 80) / Math.max(depthCount, 1));
  Object.entries(groups).forEach(([depth, labels]) => {
    const y = 50 + Number(depth) * gapY;
    const gapX = Math.min(220, (WIDTH - 80) / Math.max(labels.length, 1));
    labels.forEach((label, index) => {
      positions[label] = {
        x: 60 + index * gapX + (WIDTH - 80 - labels.length * gapX) / 2,
        y,
      };
    });
  });
  return positions;
}

function forceDirected(nodes: LayoutNode[], edges: LayoutEdge[]): Positions {
  const count = nodes.length;
  const indexOf: Record<string, number> = {};
  nodes.forEach((node, index) => {
    indexOf[node.label] = index;
  });

  const px: number[] = [];
  const py: number[] = [];
  const radius = Math.min(WIDTH, HEIGHT) / 2 - 90;
  nodes.forEach((_, index) => {
    const angle = (2 * Math.PI * index) / count - Math.PI / 2;
    px.push(WIDTH / 2 + radius * Math.cos(angle));
    py.push(HEIGHT / 2 + radius * Math.sin(angle));
  });

  const links = edges
    .map((edge) => [indexOf[edge.source_node], indexOf[edge.target_node]])
    .filter(([a, b]) => a !== undefined && b !== undefined);

  const area = WIDTH * HEIGHT;
  const k = Math.sqrt(area / Math.max(count, 1)) * 0.75;

  // Fruchterman-Reingold with a cooling schedule - deterministic, no randomness.
  for (let iteration = 0; iteration < 120; iteration += 1) {
    const dx = new Array(count).fill(0);
    const dy = new Array(count).fill(0);

    for (let i = 0; i < count; i += 1) {
      for (let j = i + 1; j < count; j += 1) {
        let deltaX = px[i] - px[j];
        let deltaY = py[i] - py[j];
        let distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY) || 0.01;
        const force = (k * k) / distance;
        deltaX = (deltaX / distance) * force;
        deltaY = (deltaY / distance) * force;
        dx[i] += deltaX;
        dy[i] += deltaY;
        dx[j] -= deltaX;
        dy[j] -= deltaY;
      }
    }

    for (const [a, b] of links) {
      let deltaX = px[a] - px[b];
      let deltaY = py[a] - py[b];
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY) || 0.01;
      const force = (distance * distance) / k;
      deltaX = (deltaX / distance) * force;
      deltaY = (deltaY / distance) * force;
      dx[a] -= deltaX;
      dy[a] -= deltaY;
      dx[b] += deltaX;
      dy[b] += deltaY;
    }

    const temperature = (k * 2) * (1 - iteration / 120);
    for (let i = 0; i < count; i += 1) {
      const magnitude = Math.sqrt(dx[i] * dx[i] + dy[i] * dy[i]) || 0.01;
      const limit = Math.min(magnitude, temperature);
      px[i] += (dx[i] / magnitude) * limit;
      py[i] += (dy[i] / magnitude) * limit;
      px[i] = Math.max(50, Math.min(WIDTH - 50, px[i]));
      py[i] = Math.max(40, Math.min(HEIGHT - 40, py[i]));
    }
  }

  const positions: Positions = {};
  nodes.forEach((node, index) => {
    positions[node.label] = { x: px[index] - 45, y: py[index] - 20 };
  });
  return positions;
}
