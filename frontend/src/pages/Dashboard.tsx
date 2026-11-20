import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  CircleDot,
  GitBranch,
  Hash,
  Layers,
  Link2,
  Network,
  RefreshCw,
  Route,
  ShieldCheck,
  Timer,
  Waypoints,
} from 'lucide-react';
import { GraphCanvas } from '../components/GraphCanvas';
import { Badge, Card, EmptyState, ErrorBlock, LoadingBlock, PageHeader, SectionTitle, StatCard } from '../components/ui';
import { useToast } from '../components/Toast';
import { useGraph } from '../hooks/useGraph';
import { apiError, getActivities, getAnalysis } from '../services/api';
import type { Activity as ActivityItem, AnalysisResult } from '../types';
import { formatNumber, relativeTime } from '../lib/format';

const ALGORITHMS = [
  {
    name: 'Breadth First Search',
    short: 'BFS',
    icon: Layers,
    time: 'O(V + E)',
    space: 'O(V)',
    tone: 'from-cyan-500/20 to-blue-500/5',
    iconTone: 'text-cyan-300',
    to: '/traversal',
    description: 'Level-by-level exploration with a FIFO queue. Finds the shortest path by hop count.',
  },
  {
    name: 'Depth First Search',
    short: 'DFS',
    icon: GitBranch,
    time: 'O(V + E)',
    space: 'O(V)',
    tone: 'from-violet-500/20 to-blue-500/5',
    iconTone: 'text-violet-300',
    to: '/traversal',
    description: 'Explores as deep as possible before backtracking. Basis for cycle and component detection.',
  },
  {
    name: 'Dijkstra',
    short: 'Dijkstra',
    icon: Route,
    time: 'O((V + E) log V)',
    space: 'O(V + E)',
    tone: 'from-blue-500/20 to-cyan-500/5',
    iconTone: 'text-blue-300',
    to: '/route-finder',
    description: 'Priority-queue shortest path for non-negative weights. Returns the optimal route.',
  },
  {
    name: 'Bellman-Ford',
    short: 'Bellman-Ford',
    icon: Waypoints,
    time: 'O(V · E)',
    space: 'O(V)',
    tone: 'from-amber-500/20 to-orange-500/5',
    iconTone: 'text-amber-300',
    to: '/route-finder',
    description: 'Relaxes every edge V-1 times, so it also handles negative weights and detects negative cycles.',
  },
];

const ACTIVITY_ICON: Record<string, { icon: typeof Activity; tone: string }> = {
  node_added: { icon: CircleDot, tone: 'text-emerald-300' },
  node_deleted: { icon: CircleDot, tone: 'text-rose-300' },
  edge_added: { icon: Link2, tone: 'text-cyan-300' },
  edge_deleted: { icon: Link2, tone: 'text-rose-300' },
  edge_updated: { icon: Link2, tone: 'text-amber-300' },
  shortest_path: { icon: Route, tone: 'text-violet-300' },
  bfs: { icon: Layers, tone: 'text-cyan-300' },
  dfs: { icon: GitBranch, tone: 'text-violet-300' },
  dijkstra: { icon: Route, tone: 'text-blue-300' },
  bellman_ford: { icon: Waypoints, tone: 'text-amber-300' },
  graph_imported: { icon: Network, tone: 'text-cyan-300' },
  graph_created: { icon: Network, tone: 'text-emerald-300' },
  graph_deleted: { icon: Network, tone: 'text-rose-300' },
  graph_updated: { icon: Network, tone: 'text-blue-300' },
  graph_reset: { icon: Network, tone: 'text-amber-300' },
};

export default function Dashboard() {
  const { graph, loading, error } = useGraph();
  const { error: toastError } = useToast();
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!graph) return;
    setBusy(true);
    try {
      const [analysisData, activityData] = await Promise.all([
        getAnalysis(graph.id),
        getActivities(8),
      ]);
      setAnalysis(analysisData);
      setActivities(activityData);
    } catch (err) {
      toastError(apiError(err));
    } finally {
      setBusy(false);
    }
  }, [graph, toastError]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error && !graph) {
    return <ErrorBlock message={error} />;
  }

  if (loading && !graph) {
    return (
      <Card className="p-6">
        <LoadingBlock label="Connecting to the graph service…" height={320} />
      </Card>
    );
  }

  if (!graph) {
    return (
      <Card>
        <EmptyState
          icon={<Network className="h-5 w-5" />}
          title="No graph selected"
          message="Create or load a sample network from Graph Management to start exploring."
          action={
            <Link to="/graphs" className="btn-primary">
              Open Graph Management
            </Link>
          }
        />
      </Card>
    );
  }

  const density = analysis?.density_percent ?? 0;
  const health = analysis
    ? [
        {
          label: 'Connectivity',
          value: analysis.connected ? 'Connected' : 'Disconnected',
          tone: analysis.connected ? 'emerald' : 'amber',
        },
        { label: 'Isolated nodes', value: String(analysis.isolated_nodes.length), tone: analysis.isolated_nodes.length ? 'amber' : 'emerald' },
        { label: 'Components', value: String(analysis.component_count), tone: 'cyan' },
        {
          label: 'Reachability',
          value: `${analysis.reachability_percentage.toFixed(1)}%`,
          tone: 'violet',
        },
      ]
    : [];

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        title="Network Overview"
        subtitle={`Live snapshot of “${graph.name}”. Every statistic below is computed by the backend from the stored adjacency list — nothing is mocked.`}
        actions={
          <>
            <button className="btn-ghost" onClick={() => void load()} disabled={busy}>
              <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <Link to="/visualizer" className="btn-primary">
              <WorkflowIcon />
              Open Visualizer
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Total Nodes" value={formatNumber(analysis?.node_count ?? graph.nodes.length)} icon={<CircleDot className="h-5 w-5" />} tone="purple" hint={graph.directed ? 'Directed graph' : 'Undirected graph'} />
        <StatCard label="Total Edges" value={formatNumber(analysis?.edge_count ?? graph.edges.length)} icon={<Link2 className="h-5 w-5" />} tone="cyan" hint={graph.weighted ? 'Weighted edges' : 'Unweighted edges'} />
        <StatCard label="Network Density" value={`${formatNumber(density, 2)}%`} icon={<Network className="h-5 w-5" />} tone="blue" hint={graph.directed ? 'E / (V(V-1))' : '2E / (V(V-1))'} />
        <StatCard label="Components" value={formatNumber(analysis?.component_count)} icon={<Layers className="h-5 w-5" />} tone="amber" hint={analysis ? `Largest: ${analysis.largest_component} nodes` : undefined} />
        <StatCard label="Average Degree" value={formatNumber(analysis?.average_degree, 2)} icon={<Waypoints className="h-5 w-5" />} tone="emerald" hint={analysis ? `Max ${analysis.max_degree} · Min ${analysis.min_degree}` : undefined} />
        <StatCard
          label="Graph Status"
          value={analysis ? (analysis.connected ? 'Healthy' : 'Partial') : '—'}
          icon={<ShieldCheck className="h-5 w-5" />}
          tone={analysis?.connected ? 'emerald' : 'rose'}
          hint={analysis ? (analysis.has_cycle ? 'Cycle detected' : 'Acyclic') : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="p-4 xl:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <SectionTitle>Network Preview</SectionTitle>
              <p className="text-xs text-slate-500">
                Drag to pan, scroll to zoom. Open the visualizer to edit nodes and edges.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={graph.directed ? 'violet' : 'cyan'}>{graph.directed ? 'Directed' : 'Undirected'}</Badge>
              <Badge tone="violet">{graph.weighted ? 'Weighted' : 'Unweighted'}</Badge>
            </div>
          </div>
          {graph.nodes.length === 0 ? (
            <EmptyState
              icon={<CircleDot className="h-5 w-5" />}
              title="This graph is empty"
              message="Add nodes on the canvas, or load one of the sample networks."
              action={
                <Link to="/visualizer" className="btn-primary">
                  Add first node
                </Link>
              }
            />
          ) : (
            <GraphCanvas
              graph={graph}
              height={360}
              editable={false}
              showWeights={graph.weighted}
              nodeStates={Object.fromEntries((analysis?.isolated_nodes ?? []).map((label) => [label, 'isolated']))}
            />
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle>Graph Health</SectionTitle>
          {analysis ? (
            <div className="space-y-3">
              {health.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 border-b border-white/[0.05] pb-2.5 last:border-0">
                  <span className="text-xs text-slate-400">{item.label}</span>
                  <Badge tone={item.tone as 'emerald'}>{item.value}</Badge>
                </div>
              ))}
              <div className="pt-1">
                <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Largest component reachability</span>
                  <span>{analysis.reachability_percentage.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all duration-700"
                    style={{ width: `${Math.max(2, analysis.reachability_percentage)}%` }}
                  />
                </div>
              </div>
              {analysis.isolated_nodes.length > 0 && (
                <p className="pt-1 text-[11px] leading-relaxed text-amber-300/90">
                  {analysis.isolated_nodes.length} isolated node(s): {analysis.isolated_nodes.slice(0, 6).join(', ')}
                  {analysis.isolated_nodes.length > 6 ? '…' : ''}
                </p>
              )}
            </div>
          ) : (
            <LoadingBlock label="Analysing network…" height={200} />
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <SectionTitle
            action={
              <Link to="/analysis" className="flex items-center gap-1 text-xs text-violet-300 hover:text-violet-200">
                Full analysis <ArrowRight className="h-3 w-3" />
              </Link>
            }
          >
            Algorithm Overview
          </SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ALGORITHMS.map((algorithm) => (
              <Link
                key={algorithm.short}
                to={algorithm.to}
                className={`group relative overflow-hidden rounded-xl border border-white/[0.07] bg-gradient-to-br ${algorithm.tone} p-4 transition hover:border-accent-purple/40`}
              >
                <div className="flex items-center justify-between">
                  <algorithm.icon className={`h-5 w-5 ${algorithm.iconTone}`} />
                  <span className="font-mono text-[10px] text-slate-400">{algorithm.time}</span>
                </div>
                <p className="mt-2.5 text-sm font-semibold text-white">{algorithm.short}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{algorithm.description}</p>
                <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500">
                  <span className="rounded border border-white/10 px-1.5 py-0.5">Space {algorithm.space}</span>
                  <span className="flex items-center gap-0.5 text-slate-400 opacity-0 transition group-hover:opacity-100">
                    Explore <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle
            action={
              <span className="text-[10px] uppercase tracking-wider text-slate-500">latest 8</span>
            }
          >
            Recent Activity
          </SectionTitle>
          {activities.length === 0 ? (
            <EmptyState icon={<Activity className="h-4 w-4" />} title="No activity yet" message="Add a node or run an algorithm to see events here." />
          ) : (
            <ul className="space-y-2.5">
              {activities.map((item) => {
                const meta = ACTIVITY_ICON[item.kind] ?? { icon: Activity, tone: 'text-slate-300' };
                const Icon = meta.icon;
                return (
                  <li key={item.id} className="flex gap-3">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03]">
                      <Icon className={`h-3.5 w-3.5 ${meta.tone}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs text-slate-300" title={item.message}>
                        {item.message}
                      </p>
                      <p className="text-[10px] text-slate-500">{relativeTime(item.created_at)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <Link to="/hashing" className="mt-4 flex items-center gap-1 text-[11px] text-cyan-300 hover:text-cyan-200">
            <Hash className="h-3 w-3" /> O(1) hash lookups explained
          </Link>
        </Card>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <Timer className="h-4 w-4 text-violet-300" />
          <p className="text-xs text-slate-400">
            Curious how these algorithms scale? Benchmark BFS, DFS, Dijkstra and Bellman-Ford on graphs up to 5000 nodes.
          </p>
        </div>
        <Link to="/benchmark" className="btn-ghost !py-1.5">
          Run benchmark <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Card>
    </div>
  );
}

function WorkflowIcon() {
  return <Network className="h-4 w-4" />;
}
