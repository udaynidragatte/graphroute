import axios from 'axios';
import type {
  Activity,
  AnalysisResult,
  BenchmarkResponse,
  BenchmarkStoredRow,
  BellmanFordResult,
  BfsResult,
  ConnectivityResult,
  DfsResult,
  DijkstraResult,
  GraphDetail,
  GraphSummary,
  HashLookup,
  HealthStatus,
  RouteResult,
  SampleInfo,
} from '../types';

export const api = axios.create({ baseURL: '/api', timeout: 120000 });

export function apiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((entry: { loc?: (string | number)[]; msg?: string }) => {
          const field = entry.loc?.slice(1).join('.') ?? '';
          return field ? `${field}: ${entry.msg ?? 'invalid value'}` : entry.msg ?? 'invalid value';
        })
        .join('; ');
    }
    if (error.code === 'ECONNABORTED') return 'The request timed out. Try a smaller benchmark.';
    if (!error.response) return 'Cannot reach the backend. Is uvicorn running on port 8000?';
    return `Request failed with status ${error.response.status}`;
  }
  return error instanceof Error ? error.message : 'Something went wrong';
}

/* ------------------------------------------------------------------ graphs */
export const listGraphs = () => api.get<GraphSummary[]>('/graphs').then((r) => r.data);
export const getGraph = (id: number) => api.get<GraphDetail>(`/graphs/${id}`).then((r) => r.data);
export const createGraph = (payload: {
  name: string;
  description?: string;
  directed?: boolean;
  weighted?: boolean;
}) => api.post<GraphDetail>('/graphs', payload).then((r) => r.data);
export const updateGraph = (
  id: number,
  payload: { name?: string; description?: string; directed?: boolean; weighted?: boolean },
) => api.put<GraphDetail>(`/graphs/${id}`, payload).then((r) => r.data);
export const deleteGraph = (id: number) => api.delete(`/graphs/${id}`);
export const duplicateGraph = (id: number) => api.post<GraphDetail>(`/graphs/${id}/duplicate`).then((r) => r.data);
export const resetGraph = (id: number) => api.post<GraphDetail>(`/graphs/${id}/reset`).then((r) => r.data);
export const importGraph = (payload: unknown) => api.post<GraphDetail>('/graphs/import', payload).then((r) => r.data);
export const exportGraphText = (id: number) => api.get(`/graphs/${id}/export`).then((r) => r.data as GraphDetail);
export const replaceStructure = (
  id: number,
  payload: {
    nodes: { label: string; x_position: number; y_position: number; metadata?: Record<string, unknown> }[];
    edges: { source_node: string; target_node: string; weight: number }[];
    directed?: boolean;
    weighted?: boolean;
  },
) => api.put<GraphDetail>(`/graphs/${id}/structure`, payload).then((r) => r.data);

export const listSamples = () => api.get<SampleInfo[]>('/samples').then((r) => r.data);
export const loadSample = (key: string) => api.post<GraphDetail>(`/samples/${key}/load`).then((r) => r.data);

/* ------------------------------------------------------------------- nodes */
export const addNode = (
  id: number,
  payload: { label: string; x_position: number; y_position: number; metadata?: Record<string, unknown> },
) => api.post<GraphDetail>(`/graphs/${id}/nodes`, payload).then((r) => r.data);
export const patchNode = (
  id: number,
  label: string,
  payload: { x_position?: number; y_position?: number; metadata?: Record<string, unknown> },
) => api.patch<GraphDetail>(`/graphs/${id}/nodes/${encodeURIComponent(label)}`, payload).then((r) => r.data);
export const deleteNode = (id: number, label: string) =>
  api.delete<GraphDetail>(`/graphs/${id}/nodes/${encodeURIComponent(label)}`).then((r) => r.data);

/* ------------------------------------------------------------------- edges */
export const addEdge = (
  id: number,
  payload: { source_node: string; target_node: string; weight: number },
) => api.post<GraphDetail>(`/graphs/${id}/edges`, payload).then((r) => r.data);
export const updateEdge = (id: number, edgeId: number, weight: number) =>
  api.patch<GraphDetail>(`/graphs/${id}/edges/${edgeId}`, { weight }).then((r) => r.data);
export const deleteEdge = (id: number, source: string, target: string) =>
  api
    .delete<GraphDetail>(`/graphs/${id}/edges`, { params: { source_node: source, target_node: target } })
    .then((r) => r.data);

/* -------------------------------------------------------------- algorithms */
export const runBfs = (graph_id: number, start: string) =>
  api.post<BfsResult>('/algorithms/bfs', { graph_id, start }).then((r) => r.data);
export const runDfs = (graph_id: number, start: string, mode: 'recursive' | 'iterative') =>
  api.post<DfsResult>('/algorithms/dfs', { graph_id, start, mode }).then((r) => r.data);
export const runDijkstra = (graph_id: number, source: string, destination?: string) =>
  api.post<DijkstraResult>('/algorithms/dijkstra', { graph_id, source, destination }).then((r) => r.data);
export const runBellmanFord = (graph_id: number, source: string, destination?: string) =>
  api.post<BellmanFordResult>('/algorithms/bellman-ford', { graph_id, source, destination }).then((r) => r.data);
export const runRoute = (payload: {
  graph_id: number;
  source: string;
  destination: string;
  algorithm: 'dijkstra' | 'bellman-ford';
  include_alternatives?: boolean;
}) => api.post<RouteResult>('/algorithms/route', payload).then((r) => r.data);

/* ---------------------------------------------------------------- analysis */
export const getAnalysis = (id: number) => api.get<AnalysisResult>(`/graphs/${id}/analysis`).then((r) => r.data);
export const getConnectivity = (id: number, source: string) =>
  api.post<ConnectivityResult>(`/graphs/${id}/connectivity`, { source }).then((r) => r.data);
export const hashLookup = (id: number, q: string) =>
  api.get<HashLookup>(`/graphs/${id}/hash-lookup`, { params: { q } }).then((r) => r.data);
export const getActivities = (limit = 12, graphId?: number) =>
  api
    .get<Activity[]>('/activities', { params: { limit, graph_id: graphId } })
    .then((r) => r.data);

/* --------------------------------------------------------------- benchmark */
export const runBenchmark = (payload: {
  sizes: number[];
  density: number;
  directed: boolean;
  connected: boolean;
  iterations?: number | null;
  algorithms: string[];
}) => api.post<BenchmarkResponse>('/benchmark/run', payload).then((r) => r.data);
export const getBenchmarkResults = () => api.get<BenchmarkStoredRow[]>('/benchmark/results').then((r) => r.data);
export const clearBenchmarkResults = () => api.delete('/benchmark/results');

/* ------------------------------------------------------------------ health */
export const getHealth = () => api.get<HealthStatus>('/health').then((r) => r.data);
