import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Clock,
  Database,
  Download,
  Eraser,
  FlaskConical,
  Info,
  Play,
  ServerCog,
  Timer,
  TriangleAlert,
} from 'lucide-react';
import { Badge, Card, EmptyState, PageHeader, SectionTitle, Spinner, StatCard } from '../components/ui';
import { useToast } from '../components/Toast';
import { apiError, clearBenchmarkResults, getBenchmarkResults, runBenchmark } from '../services/api';
import { downloadFile, formatMs, formatNumber, toCsv } from '../lib/format';
import type { BenchmarkRow } from '../types';

const PRESET_SIZES = [10, 50, 100, 500, 1000, 5000];
const ALGORITHMS = ['BFS', 'DFS', 'Dijkstra', 'Bellman-Ford'] as const;
const COLORS: Record<string, string> = {
  BFS: '#22d3ee',
  DFS: '#a78bfa',
  Dijkstra: '#3b82f6',
  'Bellman-Ford': '#f59e0b',
};

const TOOLTIP = {
  contentStyle: {
    background: '#0d1426',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    fontSize: 12,
    color: '#e2e8f0',
  },
  labelStyle: { color: '#94a3b8' },
};

const COMPLEXITY = [
  { algorithm: 'BFS', time: 'O(V + E)', space: 'O(V)', note: 'Every node and adjacency entry is touched once.' },
  { algorithm: 'DFS', time: 'O(V + E)', space: 'O(V)', note: 'Recursion/call stack or explicit stack of depth V.' },
  { algorithm: 'Dijkstra', time: 'O((V + E) log V)', space: 'O(V + E)', note: 'Binary heap; log V per extract-min and push.' },
  { algorithm: 'Bellman-Ford', time: 'O(V · E)', space: 'O(V)', note: 'V-1 passes over all edges; also detects negative cycles.' },
];

export default function Benchmarks() {
  const { error: toastError, success, info } = useToast();

  const [sizes, setSizes] = useState<number[]>([10, 50, 100, 500]);
  const [customSize, setCustomSize] = useState('');
  const [density, setDensity] = useState(0.15);
  const [directed, setDirected] = useState(false);
  const [connected, setConnected] = useState(true);
  const [algorithms, setAlgorithms] = useState<string[]>([...ALGORITHMS]);
  const [autoIterations, setAutoIterations] = useState(true);
  const [iterations, setIterations] = useState(3);
  const [rows, setRows] = useState<BenchmarkRow[]>([]);
  const [runMeta, setRunMeta] = useState<{ note: string; directed: boolean; connected: boolean; runId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const toggleSize = (size: number) => {
    setSizes((current) => (current.includes(size) ? current.filter((value) => value !== size) : [...current, size].sort((a, b) => a - b)));
  };

  const addCustomSize = () => {
    const value = Number(customSize);
    if (!Number.isInteger(value) || value < 1 || value > 5000) {
      toastError('Custom size must be a whole number between 1 and 5000');
      return;
    }
    setSizes((current) => (current.includes(value) ? current : [...current, value].sort((a, b) => a - b)));
    setCustomSize('');
  };

  const toggleAlgorithm = (algorithm: string) => {
    setAlgorithms((current) =>
      current.includes(algorithm) ? current.filter((value) => value !== algorithm) : [...current, algorithm],
    );
  };

  const run = async () => {
    if (sizes.length === 0) {
      toastError('Pick at least one graph size');
      return;
    }
    if (algorithms.length === 0) {
      toastError('Pick at least one algorithm');
      return;
    }
    setBusy(true);
    setRows([]);
    setElapsed(null);
    const started = performance.now();
    try {
      const response = await runBenchmark({
        sizes,
        density,
        directed,
        connected,
        iterations: autoIterations ? null : iterations,
        algorithms,
      });
      setRows(response.rows);
      setRunMeta({
        note: response.generation_note,
        directed: response.directed,
        connected: response.connected,
        runId: response.run_id,
      });
      setElapsed(performance.now() - started);
      success(`Benchmark finished in ${(Math.round(performance.now() - started) / 1000).toFixed(1)}s`);
    } catch (err) {
      toastError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const stored = await getBenchmarkResults();
      if (stored.length === 0) {
        info('No stored benchmark runs yet');
        return;
      }
      const latestRun = stored[0].run_id;
      const latest = stored
        .filter((row) => row.run_id === latestRun)
        .map<BenchmarkRow>((row) => ({
          run_id: row.run_id,
          algorithm: row.algorithm,
          node_count: row.node_count,
          edge_count: row.edge_count,
          graph_type: row.graph_type,
          directed: row.directed,
          iterations: row.iterations,
          avg_time_ms: row.avg_time_ms,
          min_time_ms: row.min_time_ms,
          max_time_ms: row.max_time_ms,
          visited_nodes: row.visited_nodes,
          edge_operations: row.edge_operations,
          memory_kb: row.memory_kb,
          skipped_reason: row.skipped_reason,
        }));
      setRows(latest);
      const first = stored.find((row) => row.run_id === latestRun);
      setRunMeta({
        note: 'Loaded from the stored benchmark_results table (most recent run).',
        directed: first?.directed ?? false,
        connected: first?.graph_type === 'connected',
        runId: latestRun,
      });
      info(`Loaded ${latest.length} rows from run ${latestRun}`);
    } catch (err) {
      toastError(apiError(err));
    } finally {
      setLoadingHistory(false);
    }
  };

  const clearHistory = async () => {
    try {
      await clearBenchmarkResults();
      setRows([]);
      setRunMeta(null);
      success('Stored benchmark results cleared');
    } catch (err) {
      toastError(apiError(err));
    }
  };

  const chartData = useMemo(() => {
    const sizeSet = [...new Set(rows.map((row) => row.node_count))].sort((a, b) => a - b);
    return sizeSet.map((size) => {
      const entry: Record<string, number | string | null> = { size };
      ALGORITHMS.forEach((algorithm) => {
        const row = rows.find((item) => item.node_count === size && item.algorithm === algorithm);
        entry[algorithm] = row && !row.skipped_reason ? row.avg_time_ms : null;
      });
      return entry;
    });
  }, [rows]);

  const chartAlgorithms = useMemo(
    () => ALGORITHMS.filter((algorithm) => rows.some((row) => row.algorithm === algorithm)),
    [rows],
  );

  const exportCsv = () => {
    if (rows.length === 0) return;
    const csv = toCsv(
      rows.map((row) => ({
        run_id: row.run_id,
        algorithm: row.algorithm,
        node_count: row.node_count,
        edge_count: row.edge_count,
        graph_type: row.graph_type,
        directed: row.directed,
        iterations: row.iterations,
        avg_time_ms: row.avg_time_ms,
        min_time_ms: row.min_time_ms,
        max_time_ms: row.max_time_ms,
        visited_nodes: row.visited_nodes,
        edge_operations: row.edge_operations,
        memory_kb: row.memory_kb,
        skipped_reason: row.skipped_reason,
      })),
    );
    downloadFile(`benchmark-${runMeta?.runId ?? 'results'}.csv`, csv, 'text/csv');
    success('CSV exported');
  };

  const measuredRows = rows.filter((row) => !row.skipped_reason);
  const fastest = measuredRows.length
    ? measuredRows.reduce((best, row) => (row.avg_time_ms < best.avg_time_ms ? row : best), measuredRows[0])
    : null;
  const largest = rows.length ? Math.max(...rows.map((row) => row.node_count)) : 0;

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title="Algorithm Benchmark"
        subtitle="Honest timings: each algorithm runs on a freshly generated graph, with a warm-up pass and adaptive iterations. Graph generation time is excluded. Sub-millisecond results are approximate."
        actions={
          <>
            <button className="btn-ghost" onClick={() => void loadHistory()} disabled={loadingHistory}>
              {loadingHistory ? <Spinner className="h-4 w-4" /> : <Database className="h-4 w-4" />} Load saved
            </button>
            <button className="btn-ghost" onClick={exportCsv} disabled={rows.length === 0}>
              <Download className="h-4 w-4" /> Export CSV
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <SectionTitle>Test configuration</SectionTitle>
          <div className="space-y-4">
            <div>
              <p className="label">Graph sizes (nodes)</p>
              <div className="flex flex-wrap gap-2">
                {PRESET_SIZES.map((size) => (
                  <button
                    key={size}
                    onClick={() => toggleSize(size)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                      sizes.includes(size)
                        ? 'border-violet-400/50 bg-violet-500/20 text-violet-100'
                        : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20'
                    }`}
                  >
                    {size}
                  </button>
                ))}
                {sizes
                  .filter((size) => !PRESET_SIZES.includes(size))
                  .map((size) => (
                    <button
                      key={size}
                      onClick={() => toggleSize(size)}
                      className="rounded-lg border border-cyan-400/50 bg-cyan-500/15 px-3 py-1.5 text-xs font-medium text-cyan-100"
                    >
                      {size} ✕
                    </button>
                  ))}
                <div className="flex items-center gap-1.5">
                  <input
                    className="field w-24 py-1.5 text-xs"
                    placeholder="custom"
                    value={customSize}
                    onChange={(event) => setCustomSize(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') addCustomSize();
                    }}
                  />
                  <button className="btn-ghost !px-2.5 !py-1.5 !text-xs" onClick={addCustomSize}>
                    Add
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="bench-density">
                  Edge density — {(density * 100).toFixed(0)}%
                </label>
                <input
                  id="bench-density"
                  type="range"
                  min={2}
                  max={60}
                  step={1}
                  value={density * 100}
                  onChange={(event) => setDensity(Number(event.target.value) / 100)}
                  className="w-full accent-violet-500"
                />
                <p className="mt-1 text-[10px] text-slate-500">
                  Fraction of possible edges. Dense 5000-node graphs are edge-capped at 120k edges to stay runnable.
                </p>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => setDirected((value) => !value)}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs ${
                    directed ? 'border-blue-400/40 bg-blue-500/10 text-blue-200' : 'border-white/10 bg-white/[0.02] text-slate-400'
                  }`}
                >
                  <span>Graph type</span>
                  <span>{directed ? 'Directed' : 'Undirected'}</span>
                </button>
                <button
                  onClick={() => setConnected((value) => !value)}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs ${
                    connected ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200' : 'border-amber-400/40 bg-amber-500/10 text-amber-200'
                  }`}
                >
                  <span>Structure</span>
                  <span>{connected ? 'Connected' : 'Disconnected'}</span>
                </button>
              </div>
            </div>

            <div>
              <p className="label">Algorithms</p>
              <div className="flex flex-wrap gap-2">
                {ALGORITHMS.map((algorithm) => (
                  <button
                    key={algorithm}
                    onClick={() => toggleAlgorithm(algorithm)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                      algorithms.includes(algorithm)
                        ? 'border-white/25 bg-white/10 text-white'
                        : 'border-white/10 bg-white/[0.02] text-slate-500'
                    }`}
                    style={algorithms.includes(algorithm) ? { boxShadow: `inset 0 0 0 1px ${COLORS[algorithm]}44` } : undefined}
                  >
                    <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: COLORS[algorithm] }} />
                    {algorithm}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <button
                onClick={() => setAutoIterations((value) => !value)}
                className={`rounded-lg border px-3 py-2 text-xs ${
                  autoIterations ? 'border-violet-400/40 bg-violet-500/10 text-violet-200' : 'border-white/10 bg-white/[0.02] text-slate-400'
                }`}
              >
                {autoIterations ? 'Adaptive iterations' : 'Fixed iterations'}
              </button>
              {!autoIterations && (
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={iterations}
                  onChange={(event) => setIterations(Math.min(20, Math.max(1, Number(event.target.value))))}
                  className="field w-24 py-1.5 text-xs"
                />
              )}
              <button className="btn-primary ml-auto" onClick={() => void run()} disabled={busy}>
                {busy ? <Spinner className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {busy ? 'Benchmarking…' : 'Run benchmark'}
              </button>
              <button className="btn-ghost" onClick={() => void clearHistory()} title="Clear stored runs">
                <Eraser className="h-4 w-4" />
              </button>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle>Methodology</SectionTitle>
          <ul className="space-y-2.5 text-[11px] leading-relaxed text-slate-400">
            <li className="flex gap-2"><FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-400" />Each size generates a fresh random graph with a fixed seed, so runs are repeatable.</li>
            <li className="flex gap-2"><Timer className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400" />One warm-up execution (excluded), then N measured runs using <code className="text-slate-300">time.perf_counter</code>.</li>
            <li className="flex gap-2"><Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />Reported value is the mean; min/max show variance.</li>
            <li className="flex gap-2"><ServerCog className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />Peak memory uses <code className="text-slate-300">tracemalloc</code>, measured per run.</li>
            <li className="flex gap-2"><TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />Bellman-Ford is skipped above 1500 nodes (O(V·E) would stall the UI) and marked as skipped, never faked.</li>
          </ul>
          <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-[10px] leading-relaxed text-slate-500">
            Timings come from Python on this machine. Absolute numbers are not comparable across CPUs; the relative scaling is what
            matters for a viva.
          </div>
        </Card>
      </div>

      {busy && (
        <Card className="flex flex-col items-center justify-center gap-3 p-12 text-sm text-slate-400">
          <Spinner className="h-6 w-6 text-violet-400" />
          Generating graphs and timing algorithms…
          <span className="text-[11px] text-slate-500">Large sizes can take several seconds. Graph generation is not counted.</span>
        </Card>
      )}

      {!busy && rows.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Measured rows" value={measuredRows.length} hint={`${rows.length - measuredRows.length} skipped`} icon={<Timer className="h-5 w-5" />} tone="purple" />
            <StatCard label="Largest graph" value={`${formatNumber(largest)} nodes`} hint={`up to ${formatNumber(Math.max(...rows.map((row) => row.edge_count)))} edges`} icon={<Database className="h-5 w-5" />} tone="cyan" />
            <StatCard label="Fastest average" value={fastest ? formatMs(fastest.avg_time_ms) : '—'} hint={fastest ? `${fastest.algorithm} @ ${fastest.node_count} nodes` : undefined} icon={<Play className="h-5 w-5" />} tone="emerald" />
            <StatCard label="Wall clock" value={elapsed ? `${(elapsed / 1000).toFixed(1)} s` : '—'} hint={runMeta?.runId ? `run ${runMeta.runId}` : undefined} icon={<Clock className="h-5 w-5" />} tone="amber" />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <Card className="p-5">
              <SectionTitle>Execution time by graph size</SectionTitle>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" vertical={false} />
                  <XAxis dataKey="size" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} unit="ms" />
                  <Tooltip {...TOOLTIP} formatter={(value) => (value === null ? 'skipped' : `${Number(value).toFixed(3)} ms`)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {chartAlgorithms.map((algorithm) => (
                    <Bar key={algorithm} dataKey={algorithm} fill={COLORS[algorithm]} radius={[4, 4, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-5">
              <SectionTitle>Scaling trend</SectionTitle>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" vertical={false} />
                  <XAxis dataKey="size" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} unit="ms" />
                  <Tooltip {...TOOLTIP} formatter={(value) => (value === null ? 'skipped' : `${Number(value).toFixed(3)} ms`)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {chartAlgorithms.map((algorithm) => (
                    <Line
                      key={algorithm}
                      type="monotone"
                      dataKey={algorithm}
                      stroke={COLORS[algorithm]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
              <p className="mt-2 text-[10px] leading-relaxed text-slate-500">{runMeta?.note}</p>
            </Card>
          </div>

          <Card className="p-4">
            <SectionTitle
              action={
                <Badge tone="violet">
                  {runMeta?.directed ? 'directed' : 'undirected'} · {runMeta?.connected ? 'connected' : 'disconnected'}
                </Badge>
              }
            >
              Performance comparison
            </SectionTitle>
            <div className="overflow-x-auto">
              <table className="table-base min-w-[900px]">
                <thead>
                  <tr>
                    <th>Algorithm</th>
                    <th>Nodes</th>
                    <th>Edges</th>
                    <th>Avg</th>
                    <th>Min</th>
                    <th>Max</th>
                    <th>Iters</th>
                    <th>Visited</th>
                    <th>Edge ops</th>
                    <th>Peak mem</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${row.algorithm}-${row.node_count}-${index}`}>
                      <td>
                        <span className="flex items-center gap-2 text-slate-200">
                          <span className="h-2 w-2 rounded-full" style={{ background: COLORS[row.algorithm] }} />
                          {row.algorithm}
                        </span>
                      </td>
                      <td>{formatNumber(row.node_count)}</td>
                      <td>{formatNumber(row.edge_count)}</td>
                      <td className="font-mono text-xs text-slate-100">{row.skipped_reason ? '—' : formatMs(row.avg_time_ms)}</td>
                      <td className="font-mono text-[11px]">{row.skipped_reason ? '—' : formatMs(row.min_time_ms)}</td>
                      <td className="font-mono text-[11px]">{row.skipped_reason ? '—' : formatMs(row.max_time_ms)}</td>
                      <td>{row.iterations || '—'}</td>
                      <td>{formatNumber(row.visited_nodes)}</td>
                      <td>{formatNumber(row.edge_operations)}</td>
                      <td>{row.memory_kb ? `${formatNumber(row.memory_kb, 1)} KB` : '—'}</td>
                      <td>
                        {row.skipped_reason ? (
                          <span className="text-[10px] text-amber-300" title={row.skipped_reason}>skipped</span>
                        ) : (
                          <Badge tone="emerald">measured</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.some((row) => row.skipped_reason) && (
              <div className="mt-3 space-y-1 rounded-lg border border-amber-400/20 bg-amber-500/5 p-3 text-[10px] text-amber-200">
                {[...new Set(rows.filter((row) => row.skipped_reason).map((row) => row.skipped_reason))].map((reason) => (
                  <p key={reason} className="flex gap-1.5">
                    <Info className="mt-0.5 h-3 w-3 shrink-0" /> {reason}
                  </p>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <SectionTitle>Time &amp; space complexity</SectionTitle>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {COMPLEXITY.map((item) => (
                <div key={item.algorithm} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-200">{item.algorithm}</p>
                    <span className="flex items-center gap-1.5 text-[10px]">
                      <span className="rounded bg-violet-500/10 px-1.5 py-0.5 font-mono text-violet-200">{item.time}</span>
                      <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 font-mono text-cyan-200">{item.space}</span>
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-500">{item.note}</p>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {!busy && rows.length === 0 && (
        <Card className="p-6">
          <EmptyState
            icon={<Timer className="h-5 w-5" />}
            title="No benchmark data yet"
            message="Choose graph sizes and algorithms, then press Run benchmark. Results are stored in SQLite so you can reload them later or export CSV."
          />
        </Card>
      )}
    </div>
  );
}
