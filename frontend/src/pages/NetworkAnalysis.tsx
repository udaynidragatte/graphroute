import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  CircleDot,
  GitBranch,
  Info,
  Layers,
  Link2,
  Network,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Target,
  Waypoints,
} from 'lucide-react';
import { GraphCanvas } from '../components/GraphCanvas';
import { Badge, Card, EmptyState, ErrorBlock, LoadingBlock, PageHeader, SectionTitle, Spinner, StatCard } from '../components/ui';
import { useToast } from '../components/Toast';
import { useGraph } from '../hooks/useGraph';
import { apiError, getAnalysis, getConnectivity } from '../services/api';
import { formatNumber } from '../lib/format';
import type { AnalysisResult, ConnectivityResult } from '../types';

const CHART_TOOLTIP = {
  contentStyle: {
    background: '#0d1426',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    fontSize: 12,
    color: '#e2e8f0',
  },
  labelStyle: { color: '#94a3b8' },
};

export default function NetworkAnalysis() {
  const { graph, loading } = useGraph();
  const { error: toastError } = useToast();

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [connectivity, setConnectivity] = useState<ConnectivityResult | null>(null);
  const [source, setSource] = useState('');
  const [busy, setBusy] = useState(false);
  const [connBusy, setConnBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAnalysis = useCallback(async () => {
    if (!graph) return;
    setBusy(true);
    setError(null);
    try {
      const data = await getAnalysis(graph.id);
      setAnalysis(data);
      setSource((current) => (graph.nodes.some((node) => node.label === current) ? current : graph.nodes[0]?.label ?? ''));
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }, [graph]);

  useEffect(() => {
    void loadAnalysis();
  }, [loadAnalysis]);

  useEffect(() => {
    if (!graph || !source) {
      setConnectivity(null);
      return;
    }
    let cancelled = false;
    setConnBusy(true);
    getConnectivity(graph.id, source)
      .then((data) => {
        if (!cancelled) setConnectivity(data);
      })
      .catch((err) => {
        if (!cancelled) toastError(apiError(err));
      })
      .finally(() => {
        if (!cancelled) setConnBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [graph, source, toastError]);

  const nodeStates = useMemo(() => {
    if (!connectivity) return {};
    const states: Record<string, 'start' | 'reachable' | 'unreachable' | 'isolated'> = {};
    connectivity.unreachable.forEach((label) => {
      states[label] = 'unreachable';
    });
    connectivity.reachable.forEach((label) => {
      states[label] = 'reachable';
    });
    connectivity.isolated_nodes.forEach((label) => {
      states[label] = 'isolated';
    });
    states[connectivity.source] = 'start';
    return states;
  }, [connectivity]);

  if (loading && !graph) {
    return <Card className="p-6"><Spinner /></Card>;
  }
  if (!graph) {
    return (
      <Card>
        <EmptyState
          icon={<Network className="h-5 w-5" />}
          title="No graph selected"
          message="Select a graph to run connectivity and density analysis."
          action={<Link to="/graphs" className="btn-primary">Open Graph Management</Link>}
        />
      </Card>
    );
  }

  const densityFormula = graph.directed ? 'E / (V × (V − 1))' : '2E / (V × (V − 1))';
  const degreeData = (analysis?.degree_distribution ?? []).map((bucket) => ({
    degree: bucket.degree,
    nodes: bucket.count,
  }));

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title="Network Analysis"
        subtitle="Density, degree distribution, connectivity, components and cycle detection — all computed on demand from the stored graph."
        actions={
          <button className="btn-ghost" onClick={() => void loadAnalysis()} disabled={busy}>
            <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /> Recompute
          </button>
        }
      />

      {error && <ErrorBlock message={error} onRetry={() => void loadAnalysis()} />}

      {!analysis ? (
        <Card className="p-6">
          <LoadingBlock label="Computing network metrics…" height={240} />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Nodes (V)" value={analysis.node_count} hint={`${analysis.total_degree} total degree`} icon={<CircleDot className="h-5 w-5" />} tone="purple" />
            <StatCard label="Edges (E)" value={analysis.edge_count} hint={graph.weighted ? 'weighted' : 'unweighted'} icon={<Link2 className="h-5 w-5" />} tone="cyan" />
            <StatCard label="Network density" value={`${formatNumber(analysis.density_percent, 2)}%`} hint={densityFormula} icon={<Network className="h-5 w-5" />} tone="blue" />
            <StatCard label="Connected components" value={analysis.component_count} hint={`largest ${analysis.largest_component} nodes`} icon={<Layers className="h-5 w-5" />} tone="amber" />
            <StatCard label="Average degree" value={formatNumber(analysis.average_degree, 2)} hint={`sum of degrees / V`} icon={<Waypoints className="h-5 w-5" />} tone="emerald" />
            <StatCard label="Maximum degree" value={analysis.max_degree} hint="highest connected hub" icon={<Activity className="h-5 w-5" />} tone="violet" />
            <StatCard label="Minimum degree" value={analysis.min_degree} hint="lowest connectivity" icon={<Target className="h-5 w-5" />} tone="cyan" />
            <StatCard
              label="Isolated nodes"
              value={analysis.isolated_nodes.length}
              hint={analysis.isolated_nodes.length ? analysis.isolated_nodes.join(', ') : 'none — every node is linked'}
              icon={<ShieldAlert className="h-5 w-5" />}
              tone={analysis.isolated_nodes.length ? 'rose' : 'emerald'}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <Card className="p-5 xl:col-span-2">
              <SectionTitle
                action={
                  <div className="flex gap-2">
                    <Badge tone={analysis.connected ? 'emerald' : 'amber'}>
                      {analysis.connected ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                      {analysis.connected ? 'Fully connected' : 'Disconnected'}
                    </Badge>
                    <Badge tone={analysis.has_cycle ? 'violet' : 'cyan'}>
                      {analysis.has_cycle ? 'Cycle detected' : 'Acyclic'}
                    </Badge>
                  </div>
                }
              >
                Degree distribution
              </SectionTitle>
              {degreeData.length === 0 ? (
                <EmptyState icon={<Activity className="h-4 w-4" />} title="No degrees yet" message="Add nodes and edges to build a degree distribution." />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={degreeData} margin={{ top: 8, right: 8, left: -18, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" vertical={false} />
                    <XAxis dataKey="degree" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} label={{ value: 'degree', position: 'insideBottom', offset: -2, fill: '#64748b', fontSize: 11 }} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip {...CHART_TOOLTIP} />
                    <Bar dataKey="nodes" radius={[5, 5, 0, 0]}>
                      {degreeData.map((entry, index) => (
                        <Cell key={entry.degree} fill={index % 2 === 0 ? '#8b5cf6' : '#22d3ee'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
              <p className="mt-2 text-[11px] text-slate-500">
                The distribution counts how many nodes have each degree. A long tail usually means a few highly connected hubs.
              </p>
            </Card>

            <Card className="p-5">
              <SectionTitle>Formulas &amp; health</SectionTitle>
              <div className="space-y-3 text-xs">
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="text-slate-400">Density</p>
                  <p className="mt-1 font-mono text-[11px] text-cyan-300">{densityFormula}</p>
                  <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
                    {graph.directed ? 'Directed' : 'Undirected'} mode: {analysis.edge_count} edges over {analysis.node_count} nodes →{' '}
                    {formatNumber(analysis.density_percent, 2)}%
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Largest component</span>
                  <span className="text-slate-200">{analysis.largest_component} nodes</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Reachability</span>
                  <span className="text-slate-200">{analysis.reachability_percentage.toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Cycle</span>
                  <span className={analysis.has_cycle ? 'text-amber-300' : 'text-emerald-300'}>
                    {analysis.has_cycle ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex items-start gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 text-[10px] leading-relaxed text-slate-500">
                  <Info className="mt-0.5 h-3 w-3 shrink-0 text-cyan-400" />
                  Graphs with fewer than two nodes report density 0 to avoid division by zero.
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <Card className="p-4 xl:col-span-2">
              <SectionTitle
                action={
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500">source</span>
                    <select className="field w-auto py-1 text-xs" value={source} onChange={(event) => setSource(event.target.value)}>
                      {graph.nodes.map((node) => (
                        <option key={node.id} value={node.label}>{node.label}</option>
                      ))}
                    </select>
                  </div>
                }
              >
                Connectivity map
              </SectionTitle>
              <GraphCanvas graph={graph} height={320} editable={false} showWeights={false} nodeStates={nodeStates} />
              <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-slate-500">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" /> reachable</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-400" /> unreachable</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" /> isolated</span>
              </div>
            </Card>

            <Card className="p-5">
              <SectionTitle action={connBusy ? <Spinner className="h-3.5 w-3.5 text-violet-300" /> : undefined}>
                From “{source}”
              </SectionTitle>
              {!connectivity ? (
                <LoadingBlock label="Tracing reachability…" height={180} />
              ) : (
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/5 p-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-emerald-300/80">Reachable</p>
                      <p className="mt-1 text-xl font-semibold text-emerald-200">{connectivity.reachable_count}</p>
                    </div>
                    <div className="rounded-lg border border-rose-400/20 bg-rose-500/5 p-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-rose-300/80">Unreachable</p>
                      <p className="mt-1 text-xl font-semibold text-rose-200">{connectivity.unreachable_count}</p>
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-[10px] text-slate-500">
                      <span>Reachability</span>
                      <span>{connectivity.reachability_percentage.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400" style={{ width: `${Math.max(connectivity.reachability_percentage, 1)}%` }} />
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-slate-500">Reachable nodes</p>
                    <div className="flex flex-wrap gap-1">
                      {connectivity.reachable.map((label) => (
                        <span key={label} className="rounded border border-emerald-400/20 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-200">{label}</span>
                      ))}
                    </div>
                  </div>
                  {connectivity.unreachable.length > 0 && (
                    <div>
                      <p className="mb-1 text-slate-500">Unreachable nodes</p>
                      <div className="flex flex-wrap gap-1">
                        {connectivity.unreachable.map((label) => (
                          <span key={label} className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">{label}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 border-t border-white/[0.06] pt-2.5">
                    <Badge tone={connectivity.weakly_connected ? 'emerald' : 'rose'}>
                      {connectivity.weakly_connected ? 'Weakly connected' : 'Not weakly connected'}
                    </Badge>
                    {connectivity.directed && (
                      <Badge tone={connectivity.strongly_connected ? 'emerald' : 'amber'}>
                        {connectivity.strongly_connected ? 'Strongly connected' : 'Not strongly connected'}
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] leading-relaxed text-slate-500">
                    {connectivity.directed
                      ? 'Weak connectivity ignores edge direction; strong connectivity requires a directed path in both directions (Kosaraju).'
                      : 'In an undirected graph, reachable nodes from any source form exactly one connected component.'}
                  </p>
                </div>
              )}
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card className="p-5">
              <SectionTitle>Connected components</SectionTitle>
              <div className="space-y-2">
                {analysis.components.map((component, index) => (
                  <div key={index} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <div className="mb-1 flex items-center justify-between text-[10px] text-slate-500">
                      <span>Component {index + 1}</span>
                      <span>{component.length} nodes</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {component.map((label) => (
                        <span key={label} className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-300">{label}</span>
                      ))}
                    </div>
                  </div>
                ))}
                {analysis.components.length === 0 && <p className="text-xs text-slate-500">The graph has no nodes.</p>}
              </div>
            </Card>

            <Card className="p-5">
              <SectionTitle
                action={
                  connectivity?.directed && connectivity.strong_components.length > 0 ? (
                    <Badge tone="violet">{connectivity.strong_components.length} SCCs</Badge>
                  ) : undefined
                }
              >
                {connectivity?.directed ? 'Strongly connected components' : 'Isolated nodes'}
              </SectionTitle>
              {connectivity?.directed ? (
                <div className="space-y-2">
                  {connectivity.strong_components.map((component, index) => (
                    <div key={index} className="flex flex-wrap items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2">
                      <span className="mr-1 text-[10px] text-slate-500">SCC {index + 1}</span>
                      {component.map((label) => (
                        <span key={label} className="rounded border border-violet-400/20 bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-200">{label}</span>
                      ))}
                    </div>
                  ))}
                </div>
              ) : analysis.isolated_nodes.length === 0 ? (
                <p className="text-xs text-slate-500">No isolated nodes — every node has at least one edge.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {analysis.isolated_nodes.map((label) => (
                    <span key={label} className="rounded border border-amber-400/25 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">{label}</span>
                  ))}
                </div>
              )}
              <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-[10px] leading-relaxed text-slate-500">
                In simple terms: a component is an island of nodes that can reach each other. Isolated nodes are islands of size one.
                {analysis.has_cycle && ' This graph contains at least one cycle, so it is not a tree.'}
              </div>
              <div className="mt-3 flex gap-2">
                <Link to="/traversal" className="btn-ghost !py-1.5 !text-[11px]">
                  <GitBranch className="h-3.5 w-3.5" /> Trace traversal
                </Link>
                <Link to="/route-finder" className="btn-ghost !py-1.5 !text-[11px]">
                  <Waypoints className="h-3.5 w-3.5" /> Find route
                </Link>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
