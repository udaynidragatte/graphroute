export type Metadata = Record<string, unknown>;

export interface GraphNode {
  id: number;
  label: string;
  x_position: number;
  y_position: number;
  metadata: Metadata;
}

export interface GraphEdge {
  id: number;
  source_node: string;
  target_node: string;
  weight: number;
}

export interface GraphDetail {
  id: number;
  name: string;
  description: string;
  directed: boolean;
  weighted: boolean;
  created_at: string;
  updated_at: string;
  node_count: number;
  edge_count: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphSummary {
  id: number;
  name: string;
  description: string;
  directed: boolean;
  weighted: boolean;
  node_count: number;
  edge_count: number;
  created_at: string;
  updated_at: string;
}

export interface SampleInfo {
  key: string;
  name: string;
  description: string;
  node_count: number;
  edge_count: number;
  directed: boolean;
  weighted: boolean;
  already_loaded: boolean;
}

export interface QueueOp {
  action: string;
  node: string;
  from?: string;
  reason?: string;
  queue?: string[];
  stack?: string[];
}

export interface BfsResult {
  algorithm: string;
  start: string;
  order: string[];
  visited: string[];
  unreachable: string[];
  parent: Record<string, string | null>;
  levels: Record<string, number>;
  tree_edges: [string, string][];
  queue_ops: QueueOp[];
  edge_operations: number;
  complexity: Complexity;
}

export interface DfsResult {
  algorithm: string;
  start: string;
  order: string[];
  visited: string[];
  unreachable: string[];
  parent: Record<string, string | null>;
  discovery: Record<string, number>;
  finish: Record<string, number>;
  tree_edges: [string, string][];
  stack_ops: QueueOp[];
  edge_operations: number;
  complexity: Complexity;
}

export interface Complexity {
  time: string;
  space: string;
}

export interface DijkstraResult {
  algorithm: string;
  source: string;
  destination: string | null;
  distance: number | null;
  path: string[];
  hops: number;
  distances: Record<string, number | null>;
  previous: Record<string, string | null>;
  visited: string[];
  relaxations: number;
  heap_pops: number;
  trace: RelaxationStep[];
  trace_truncated: boolean;
  complexity: Complexity;
}

export interface RelaxationStep {
  type?: 'extract' | 'relax';
  iteration?: number;
  node?: string;
  from?: string;
  to?: string;
  edge_weight?: number;
  candidate?: number;
  accepted?: boolean;
  distance?: number | null;
  distances: Record<string, number | null>;
  visited?: string[];
}

export interface BellmanFordResult {
  algorithm: string;
  source: string;
  destination: string | null;
  distance: number | null;
  path: string[];
  hops: number;
  distances: Record<string, number | null>;
  previous: Record<string, string | null>;
  relaxations: number;
  iterations: number;
  converged_early: boolean;
  negative_cycle: string[];
  has_negative_cycle: boolean;
  trace: RelaxationStep[];
  trace_truncated: boolean;
  complexity: Complexity;
}

export interface AlternativeRoute {
  path: string[];
  cost: number;
  hops: number;
}

export interface RouteResult {
  algorithm: string;
  source: string;
  destination: string;
  reachable: boolean;
  distance: number | null;
  hops: number;
  path: string[];
  visited: string[];
  relaxations: number;
  has_negative_cycle: boolean;
  negative_cycle: string[];
  alternatives: AlternativeRoute[];
  alternatives_truncated: boolean;
  complexity: Complexity;
  distances: Record<string, number | null>;
}

export interface DegreeBucket {
  degree: number;
  count: number;
}

export interface AnalysisResult {
  graph_id: number;
  graph_name: string;
  node_count: number;
  edge_count: number;
  directed: boolean;
  weighted: boolean;
  average_degree: number;
  max_degree: number;
  min_degree: number;
  isolated_nodes: string[];
  components: string[][];
  component_count: number;
  largest_component: number;
  reachability_percentage: number;
  network_density: number;
  density_percent: number;
  has_cycle: boolean;
  connected: boolean;
  degree_distribution: DegreeBucket[];
  total_degree: number;
  degrees: Record<string, number>;
}

export interface ConnectivityResult {
  source: string;
  reachable: string[];
  unreachable: string[];
  reachable_count: number;
  unreachable_count: number;
  reachability_percentage: number;
  components: string[][];
  isolated_nodes: string[];
  directed: boolean;
  weakly_connected: boolean;
  strongly_connected: boolean;
  strong_components: string[][];
  strong_component_of_source: number | null;
}

export interface Activity {
  id: number;
  graph_id: number | null;
  kind: string;
  message: string;
  created_at: string;
}

export interface BenchmarkRow {
  run_id: string;
  algorithm: string;
  node_count: number;
  edge_count: number;
  graph_type: string;
  directed: boolean;
  iterations: number;
  avg_time_ms: number;
  min_time_ms: number;
  max_time_ms: number;
  visited_nodes: number;
  edge_operations: number;
  memory_kb: number;
  skipped_reason: string;
  graph_generation_ms?: number;
}

export interface BenchmarkResponse {
  run_id: string;
  generated_at: string;
  density: number;
  directed: boolean;
  connected: boolean;
  generation_note: string;
  rows: BenchmarkRow[];
}

export interface BenchmarkStoredRow extends BenchmarkRow {
  id: number;
  created_at: string;
}

export interface HashLookup {
  query: string;
  found: boolean;
  directed: boolean;
  lookup_time_us: number;
  lookup_type: string;
  node: { id: string; label: string; metadata: Metadata } | null;
  neighbors: Record<string, number>;
  neighbor_count: number;
  degree: number;
  incoming: string[];
  demo_hash: number;
  bucket: number;
  buckets: { index: number; nodes: string[] }[];
  adjacency_table: Record<string, Record<string, number>>;
  node_count: number;
  edge_count: number;
  complexity: { average: string; worst: string };
}

export interface HealthStatus {
  status: string;
  version: string;
  graphs: number;
  nodes: number;
}
