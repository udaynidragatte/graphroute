import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowRightLeft,
  Clock,
  Compass,
  Flag,
  Gauge,
  GitCompareArrows,
  Info,
  Route as RouteIcon,
  Search,
  TriangleAlert,
} from 'lucide-react';
import { GraphCanvas } from '../components/GraphCanvas';
import { Badge, Card, EmptyState, PageHeader, SectionTitle, Spinner, StatCard } from '../components/ui';
import { useToast } from '../components/Toast';
import { useGraph } from '../hooks/useGraph';
import { apiError, runRoute } from '../services/api';
import { edgeKey, formatMs, formatNumber, formatWeight } from '../lib/format';
import type { RouteResult } from '../types';

interface ComparisonRow {
  algorithm: string;
  distance: number | null;
  hops: number;
  path: string[];
  note: string;
}

export default function RouteFinder() {
  const { graph, loading } = useGraph();
  const { error: toastError } = useToast();

  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [algorithm, setAlgorithm] = useState<'dijkstra' | 'bellman-ford'>('dijkstra');
  const [includeAlternatives, setIncludeAlternatives] = useState(true);
  const [result, setResult] = useState<RouteResult | null>(null);
  const [comparison, setComparison] = useState<ComparisonRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);

  useEffect(() => {
    if (!graph) return;
    const labels = graph.nodes.map((node) => node.label);
    setSource((current) => (labels.includes(current) ? current : labels[0] ?? ''));
    setDestination((current) => (labels.includes(current) ? current : labels[labels.length - 1] ?? ''));
    setResult(null);
    setComparison([]);
  }, [graph?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const calculate = useCallback(async () => {
    if (!graph) return;
    if (!source || !destination) {
      toastError('Choose both a source and a destination');
      return;
    }
    if (source === destination) {
      toastError('Source and destination must be different');
      return;
    }
    setBusy(true);
    setResult(null);
    setComparison([]);
    const started = performance.now();
    try {
      const main = await runRoute({
        graph_id: graph.id,
        source,
        destination,
        algorithm,
        include_alternatives: includeAlternatives,
      });
      setElapsed(performance.now() - started);
      setResult(main);

      const rows: ComparisonRow[] = [
        {
          algorithm: main.algorithm,
          distance: main.distance,
          hops: main.hops,
          path: main.path,
          note: 'selected algorithm',
        },
      ];
      const other = algorithm === 'dijkstra' ? 'bellman-ford' : 'dijkstra';
      try {
        const alternate = await runRoute({
          graph_id: graph.id,
          source,
          destination,
          algorithm: other,
          include_alternatives: false,
        });
        rows.push({
          algorithm: alternate.algorithm,
          distance: alternate.distance,
          hops: alternate.hops,
          path: alternate.path,
          note: 'verification run',
        });
      } catch (err) {
        rows.push({
          algorithm: other === 'dijkstra' ? 'Dijkstra' : 'Bellman-Ford',
          distance: null,
          hops: 0,
          path: [],
          note: apiError(err),
        });
      }
      setComparison(rows);
    } catch (err) {
      toastError(apiError(err));
      setResult(null);
    } finally {
      setBusy(false);
    }
  }, [graph, source, destination, algorithm, includeAlternatives, toastError]);

  const nodeStates = useMemo(() => {
    if (!result || result.path.length === 0) {
      return { [source]: 'start' as const, [destination]: 'end' as const };
    }
    const states: Record<string, 'start' | 'end' | 'path' | 'visited'> = {};
    result.path.forEach((label, index) => {
      states[label] = index === 0 ? 'start' : index === result.path.length - 1 ? 'end' : 'path';
    });
    return states;
  }, [result, source, destination]);

  const activeEdges = useMemo(() => {
    if (!result) return [];
    return result.path.slice(0, -1).map((label, index) => edgeKey(label, result.path[index + 1]));
  }, [result]);

  if (loading && !graph) {
    return <Card className="p-6"><Spinner /></Card>;
  }

  if (!graph) {
    return (
      <Card>
        <EmptyState
          icon={<RouteIcon className="h-5 w-5" />}
          title="No graph available"
          message="Load a sample network or create your own graph to find routes."
          action={<Link to="/graphs" className="btn-primary">Open Graph Management</Link>}
        />
      </Card>
    );
  }

  if (graph.nodes.length === 0) {
    return (
      <Card className="p-6">
        <EmptyState
          icon={<Compass className="h-5 w-5" />}
          title="“{graph.name}” is empty"
          message="The route finder needs nodes and edges. Build a network in the visualizer first."
          action={<Link to="/visualizer" className="btn-primary">Open Visualizer</Link>}
        />
      </Card>
    );
  }

  const hasNegativeWeights = graph.edges.some((edge) => edge.weight < 0);

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title="Route Finder"
        subtitle="Compute the optimal route with Dijkstra or Bellman-Ford, then compare it against alternative simple paths. Results come from real graph traversal, not cached sample output."
      />

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <div>
            <label className="label" htmlFor="route-source">Source</label>
            <select id="route-source" className="field" value={source} onChange={(event) => setSource(event.target.value)}>
              {graph.nodes.map((node) => (
                <option key={node.id} value={node.label}>{node.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="route-destination">Destination</label>
            <select id="route-destination" className="field" value={destination} onChange={(event) => setDestination(event.target.value)}>
              {graph.nodes.map((node) => (
                <option key={node.id} value={node.label}>{node.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="route-algorithm">Algorithm</label>
            <select
              id="route-algorithm"
              className="field"
              value={algorithm}
              onChange={(event) => setAlgorithm(event.target.value as 'dijkstra' | 'bellman-ford')}
            >
              <option value="dijkstra">Dijkstra — non-negative weights</option>
              <option value="bellman-ford">Bellman-Ford — negative weights</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setIncludeAlternatives((value) => !value)}
              className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-xs transition ${
                includeAlternatives ? 'border-violet-400/40 bg-violet-500/10 text-violet-200' : 'border-white/10 bg-white/[0.03] text-slate-400'
              }`}
            >
              <GitCompareArrows className="h-4 w-4" />
              {includeAlternatives ? 'Alternatives on' : 'Alternatives off'}
            </button>
          </div>
          <div className="flex items-end">
            <button className="btn-ghost flex-1" onClick={() => { setSource(destination); setDestination(source); setResult(null); setComparison([]); }}>
              <ArrowRightLeft className="h-4 w-4" /> Swap
            </button>
          </div>
          <div className="flex items-end">
            <button className="btn-primary w-full" onClick={() => void calculate()} disabled={busy}>
              {busy ? <Spinner className="h-4 w-4" /> : <Search className="h-4 w-4" />}
              {busy ? 'Calculating…' : 'Calculate route'}
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
          <Badge tone={algorithm === 'dijkstra' ? 'cyan' : 'amber'}>
            {algorithm === 'dijkstra' ? 'O((V + E) log V)' : 'O(V · E)'}
          </Badge>
          <span className="text-slate-500">
            {algorithm === 'dijkstra'
              ? 'Uses a binary min-heap. Rejects negative edge weights.'
              : 'Relaxes every edge V-1 times and detects negative cycles.'}
          </span>
          {hasNegativeWeights && algorithm === 'dijkstra' && (
            <span className="flex items-center gap-1 text-rose-300">
              <TriangleAlert className="h-3.5 w-3.5" /> This graph has negative weights — pick Bellman-Ford.
            </span>
          )}
        </div>
      </Card>

      {busy && (
        <Card className="flex items-center justify-center gap-3 p-10 text-sm text-slate-400">
          <Spinner className="h-5 w-5 text-violet-400" /> Relaxing edges…
        </Card>
      )}

      {!busy && !result && (
        <Card className="p-6">
          <EmptyState
            icon={<RouteIcon className="h-5 w-5" />}
            title="Pick two nodes and calculate"
            message="The shortest path, alternative routes and a comparison table will appear here. Dijkstra and Bellman-Ford are both executed by the backend for cross-checking."
          />
        </Card>
      )}

      {result && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard
              label="Shortest distance"
              value={result.reachable && result.distance !== null ? formatWeight(result.distance) : 'Unreachable'}
              hint={graph.weighted ? 'sum of edge weights' : 'hops counted as 1 each'}
              icon={<Gauge className="h-5 w-5" />}
              tone={result.reachable ? 'purple' : 'rose'}
            />
            <StatCard label="Total hops" value={result.reachable ? formatNumber(result.hops) : '—'} icon={<Flag className="h-5 w-5" />} tone="cyan" />
            <StatCard label="Algorithm" value={result.algorithm} hint={result.complexity.time} icon={<RouteIcon className="h-5 w-5" />} tone="blue" />
            <StatCard label="Relaxations" value={formatNumber(result.relaxations)} hint={`${result.visited.length} nodes settled`} icon={<Compass className="h-5 w-5" />} tone="emerald" />
            <StatCard label="Compute time" value={elapsed !== null ? formatMs(Number(elapsed.toFixed(2))) : '—'} hint="round-trip incl. HTTP" icon={<Clock className="h-5 w-5" />} tone="amber" />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
            <Card className="p-5 xl:col-span-3">
              <SectionTitle>Optimal route</SectionTitle>
              {result.reachable ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    {result.path.map((label, index) => (
                      <span key={`${label}-${index}`} className="flex items-center gap-2">
                        <span
                          className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                            index === 0
                              ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                              : index === result.path.length - 1
                                ? 'border-rose-400/40 bg-rose-500/15 text-rose-200'
                                : 'border-violet-400/30 bg-violet-500/10 text-violet-100'
                          }`}
                        >
                          {label}
                        </span>
                        {index < result.path.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-slate-500" />}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 rounded-lg border border-violet-400/20 bg-violet-500/5 px-3 py-2 text-sm text-violet-100">
                    Total {graph.weighted ? 'cost' : 'hops'}: <span className="font-semibold">{formatWeight(result.distance ?? 0)}</span>
                    <span className="ml-3 text-xs text-slate-400">{result.path.length} nodes · {result.hops} edges</span>
                  </div>
                  {result.has_negative_cycle && (
                    <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-xs text-rose-200">
                      Negative weight cycle detected: {result.negative_cycle.join(' → ')}. Shortest distances are undefined.
                    </p>
                  )}
                  <GraphCanvas
                    graph={graph}
                    height={340}
                    editable={false}
                    showWeights={graph.weighted}
                    nodeStates={nodeStates}
                    activeEdges={activeEdges}
                    className="mt-4"
                  />
                </>
              ) : (
                <div className="rounded-xl border border-rose-400/20 bg-rose-500/5 p-4 text-sm text-rose-200">
                  <p className="font-medium">Destination unreachable</p>
                  <p className="mt-1 text-xs text-rose-200/80">
                    No path exists from <span className="font-semibold">{source}</span> to <span className="font-semibold">{destination}</span> in this{' '}
                    {graph.directed ? 'directed' : 'undirected'} graph. {result.visited.length} nodes were reachable from the source.
                  </p>
                </div>
              )}
            </Card>

            <Card className="p-5 xl:col-span-2">
              <SectionTitle>Comparison</SectionTitle>
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Algorithm</th>
                      <th>Cost</th>
                      <th>Hops</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.map((row) => (
                      <tr key={row.algorithm}>
                        <td>
                          <p className="text-slate-200">{row.algorithm}</p>
                          <p className="text-[10px] text-slate-500">{row.note}</p>
                        </td>
                        <td className="font-mono text-xs">{row.distance === null ? '—' : formatWeight(row.distance)}</td>
                        <td>{row.hops || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 space-y-2 text-[11px] leading-relaxed text-slate-400">
                <p className="flex gap-2">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400" />
                  Dijkstra is faster on non-negative graphs; Bellman-Ford also runs here so you can see both algorithms agree on
                  the same optimal cost.
                </p>
                {result.distances && (
                  <details className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-2.5">
                    <summary className="cursor-pointer text-[11px] text-slate-300">Distance table from {source}</summary>
                    <div className="mt-2 grid grid-cols-2 gap-1 font-mono text-[10px] text-slate-400">
                      {Object.entries(result.distances).map(([label, value]) => (
                        <div key={label} className="flex justify-between rounded bg-white/[0.03] px-1.5 py-1">
                          <span>{label}</span>
                          <span className="text-slate-200">{value === null ? '∞' : formatWeight(value)}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </Card>
          </div>

          <Card className="p-5">
            <SectionTitle
              action={
                <span className="text-[10px] text-slate-500">
                  {result.alternatives.length} alternative{result.alternatives.length === 1 ? '' : 's'} found
                  {result.alternatives_truncated ? ' · search truncated' : ''}
                </span>
              }
            >
              Alternative routes
            </SectionTitle>
            {result.alternatives.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-500">
                No alternative simple path found for this pair. Alternatives are enumerated by a bounded DFS and are <em>not</em>{' '}
                guaranteed to be the next-best routes.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Path</th>
                      <th>Cost</th>
                      <th>Hops</th>
                      <th>vs optimal</th>
                      <th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-violet-500/5">
                      <td className="text-violet-300">★</td>
                      <td className="text-slate-200">{result.path.join(' → ') || '—'}</td>
                      <td className="font-mono">{result.distance === null ? '—' : formatWeight(result.distance)}</td>
                      <td>{result.hops}</td>
                      <td className="text-emerald-300">0</td>
                      <td><Badge tone="violet">Guaranteed optimal</Badge></td>
                    </tr>
                    {result.alternatives.map((alternative, index) => (
                      <tr key={alternative.path.join('-')}>
                        <td className="text-slate-500">{index + 1}</td>
                        <td className="text-slate-300">{alternative.path.join(' → ')}</td>
                        <td className="font-mono">{formatWeight(alternative.cost)}</td>
                        <td>{alternative.hops}</td>
                        <td className={result.distance !== null && alternative.cost > result.distance ? 'text-amber-300' : 'text-slate-400'}>
                          {result.distance !== null ? `+${formatWeight(alternative.cost - result.distance)}` : '—'}
                        </td>
                        <td><Badge>Alternative</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-[11px] text-slate-500">
              Alternatives are distinct simple paths (no repeated nodes) found by depth-first enumeration, sorted by cost. Only the
              highlighted row is proven optimal by {result.algorithm}.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
