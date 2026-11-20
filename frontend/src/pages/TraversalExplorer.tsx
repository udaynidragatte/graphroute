import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  CircleDot,
  GitBranch,
  Info,
  Layers,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Table2,
} from 'lucide-react';
import { GraphCanvas } from '../components/GraphCanvas';
import { Badge, Card, EmptyState, PageHeader, SectionTitle, Spinner, StatCard } from '../components/ui';
import { useToast } from '../components/Toast';
import { useGraph } from '../hooks/useGraph';
import { useSettings } from '../hooks/useSettings';
import { apiError, runBfs, runDfs } from '../services/api';
import { edgeKey } from '../lib/format';
import type { BfsResult, DfsResult, QueueOp } from '../types';

type Mode = 'bfs' | 'recursive' | 'iterative';
type TraversalResult = BfsResult | DfsResult;

const MODE_META: Record<Mode, { label: string; structure: string; time: string; space: string; blurb: string }> = {
  bfs: {
    label: 'BFS — queue',
    structure: 'Queue (FIFO)',
    time: 'O(V + E)',
    space: 'O(V)',
    blurb:
      'Breadth First Search visits every neighbour of the current node before moving one level deeper. The queue holds the frontier, so the traversal order is level by level.',
  },
  recursive: {
    label: 'DFS — recursive',
    structure: 'Call stack',
    time: 'O(V + E)',
    space: 'O(V)',
    blurb:
      'Recursive DFS dives as deep as possible, then returns (backtracks) when no unvisited neighbour remains. The recursion stack is the data structure, shown here as a simulated stack.',
  },
  iterative: {
    label: 'DFS — iterative',
    structure: 'Explicit stack',
    time: 'O(V + E)',
    space: 'O(V)',
    blurb:
      'Iterative DFS replaces recursion with an explicit stack of (node, neighbour iterator) frames, so backtracking and stack pushes are observable step by step.',
  },
};

interface ViewState {
  visited: Set<string>;
  current: string | null;
  frontier: string[];
  lastOp: QueueOp | null;
  activeEdges: string[];
}

export default function TraversalExplorer() {
  const { graph, loading } = useGraph();
  const { preferences } = useSettings();
  const { error: toastError } = useToast();

  const [mode, setMode] = useState<Mode>('bfs');
  const [start, setStart] = useState('');
  const [result, setResult] = useState<TraversalResult | null>(null);
  const [ops, setOps] = useState<QueueOp[]>([]);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(preferences.animationSpeed);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!graph) return;
    const labels = graph.nodes.map((node) => node.label);
    setStart((current) => (labels.includes(current) ? current : labels[0] ?? ''));
    setResult(null);
    setOps([]);
    setStep(0);
    setPlaying(false);
  }, [graph?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!playing || ops.length === 0) return;
    if (step >= ops.length - 1) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => setStep((value) => Math.min(value + 1, ops.length - 1)), Math.max(speed, 120));
    return () => window.clearTimeout(timer);
  }, [playing, step, ops.length, speed]);

  const run = useCallback(async () => {
    if (!graph || !start) return;
    setBusy(true);
    setPlaying(false);
    try {
      if (mode === 'bfs') {
        const data = await runBfs(graph.id, start);
        setResult(data);
        setOps(data.queue_ops);
      } else {
        const data = await runDfs(graph.id, start, mode);
        setResult(data);
        setOps(data.stack_ops);
      }
      setStep(0);
      setPlaying(true);
    } catch (err) {
      toastError(apiError(err));
    } finally {
      setBusy(false);
    }
  }, [graph, start, mode, toastError]);

  const view = useMemo<ViewState>(() => {
    const visited = new Set<string>();
    let current: string | null = null;
    let frontier: string[] = [];
    let lastOp: QueueOp | null = null;

    for (let index = 0; index <= step && index < ops.length; index += 1) {
      const op = ops[index];
      lastOp = op;
      frontier = op.queue ?? op.stack ?? [];
      if (mode === 'bfs') {
        if (op.action === 'dequeue') {
          visited.add(op.node);
          current = op.node;
        }
      } else if (op.action === 'discover' || op.action === 'push') {
        visited.add(op.node);
        current = op.node;
      }
    }

    const activeEdges: string[] = [];
    if (result) {
      for (const node of visited) {
        const parent = result.parent[node];
        if (parent) activeEdges.push(edgeKey(parent, node));
      }
    }
    return { visited, current, frontier, lastOp, activeEdges };
  }, [ops, step, mode, result]);

  const nodeStates = useMemo(() => {
    const states: Record<string, 'visited' | 'path' | 'default'> = {};
    view.visited.forEach((label) => {
      states[label] = 'visited';
    });
    if (view.current) states[view.current] = 'path';
    return states;
  }, [view]);

  if (loading && !graph) {
    return <Card className="p-6"><Spinner /></Card>;
  }

  if (!graph) {
    return (
      <Card>
        <EmptyState
          icon={<GitBranch className="h-5 w-5" />}
          title="No graph selected"
          message="Load a network from Graph Management to explore its traversals."
          action={<Link to="/graphs" className="btn-primary">Open Graph Management</Link>}
        />
      </Card>
    );
  }

  const meta = MODE_META[mode];
  const totalSteps = ops.length;
  const progress = totalSteps ? ((step + 1) / totalSteps) * 100 : 0;
  const treeEdges = result
    ? Object.entries(result.parent)
        .filter(([, parent]) => parent !== null)
        .map(([child, parent]) => `${parent} → ${child}`)
    : [];

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title="Traversal Explorer"
        subtitle="Run BFS or DFS on the real adjacency list and step through every queue push, visit and backtrack. The animation is driven by the backend trace, not a scripted loop."
      />

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div>
            <label className="label" htmlFor="traversal-start">Start node</label>
            <select id="traversal-start" className="field" value={start} onChange={(event) => setStart(event.target.value)}>
              {graph.nodes.map((node) => (
                <option key={node.id} value={node.label}>{node.label}</option>
              ))}
            </select>
          </div>
          <div className="xl:col-span-2">
            <label className="label" htmlFor="traversal-mode">Algorithm</label>
            <select id="traversal-mode" className="field" value={mode} onChange={(event) => setMode(event.target.value as Mode)}>
              <option value="bfs">BFS — breadth first search (queue)</option>
              <option value="recursive">DFS — recursive</option>
              <option value="iterative">DFS — iterative (explicit stack)</option>
            </select>
          </div>
          <div className="flex items-end">
            <button className="btn-primary w-full" onClick={() => void run()} disabled={busy || !start}>
              {busy ? <Spinner className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {busy ? 'Running…' : 'Run traversal'}
            </button>
          </div>
          <div className="flex items-end gap-2">
            <button
              className="btn-ghost flex-1"
              onClick={() => {
                setStep(0);
                setPlaying(false);
              }}
              disabled={!result}
            >
              <RotateCcw className="h-4 w-4" /> Reset
            </button>
          </div>
        </div>
        <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-slate-400">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400" />
          {meta.blurb}
        </p>
      </Card>

      {!result ? (
        <Card className="p-6">
          <EmptyState
            icon={<Layers className="h-5 w-5" />}
            title="No traversal yet"
            message="Choose a start node and press Run traversal to generate the step-by-step execution trace."
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Nodes visited" value={view.visited.size} hint={`of ${graph.nodes.length} total`} icon={<CircleDot className="h-5 w-5" />} tone="purple" />
            <StatCard label="Traversal order" value={`${result.visited.length} nodes`} hint={result.unreachable.length ? `${result.unreachable.length} unreachable` : 'all nodes reachable'} icon={<GitBranch className="h-5 w-5" />} tone="cyan" />
            <StatCard label="Edge operations" value={result.edge_operations} hint="adjacency entries examined" icon={<Table2 className="h-5 w-5" />} tone="blue" />
            <StatCard label="Complexity" value={meta.time} hint={`space ${meta.space}`} icon={<Layers className="h-5 w-5" />} tone="amber" />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <Card className="p-4 xl:col-span-2">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <SectionTitle>Traversal animation</SectionTitle>
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <Badge tone="violet">{meta.structure}</Badge>
                  <span>step {Math.min(step + 1, totalSteps)} / {totalSteps || 1}</span>
                </div>
              </div>

              <GraphCanvas
                graph={graph}
                height={preferences.canvasHeight}
                editable={false}
                showWeights={false}
                nodeStates={nodeStates}
                activeEdges={view.activeEdges}
              />

              <div className="mt-3">
                <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
                  <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all duration-200" style={{ width: `${Math.max(progress, 1)}%` }} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button className="btn-ghost !px-2.5 !py-1.5" onClick={() => { setPlaying(false); setStep(0); }} title="Restart">
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <button className="btn-ghost !px-2.5 !py-1.5" onClick={() => { setPlaying(false); setStep((value) => Math.max(0, value - 1)); }} disabled={step <= 0} title="Previous step">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    className="btn-primary !px-3 !py-1.5"
                    onClick={() => {
                      if (step >= totalSteps - 1) setStep(0);
                      setPlaying((value) => !value);
                    }}
                  >
                    {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {playing ? 'Pause' : 'Play'}
                  </button>
                  <button className="btn-ghost !px-2.5 !py-1.5" onClick={() => { setPlaying(false); setStep((value) => Math.min(totalSteps - 1, value + 1)); }} disabled={step >= totalSteps - 1} title="Next step">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button className="btn-ghost !px-2.5 !py-1.5" onClick={() => { setPlaying(false); setStep(totalSteps - 1); }} disabled={step >= totalSteps - 1} title="Jump to end">
                    <SkipForward className="h-4 w-4" />
                  </button>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-[11px] text-slate-500">Speed</span>
                    <input
                      type="range"
                      min={150}
                      max={2000}
                      step={50}
                      value={2150 - speed}
                      onChange={(event) => setSpeed(2150 - Number(event.target.value))}
                      className="w-28 accent-violet-500"
                    />
                    <span className="w-14 font-mono text-[10px] text-slate-400">{speed} ms</span>
                  </div>
                </div>
              </div>
            </Card>

            <div className="space-y-4">
              <Card className="p-4">
                <SectionTitle>{mode === 'bfs' ? 'Queue' : 'Stack'}</SectionTitle>
                <div className="flex min-h-[42px] flex-wrap items-center gap-1.5">
                  {view.frontier.length === 0 ? (
                    <span className="text-xs text-slate-500">empty</span>
                  ) : (
                    view.frontier.map((label, index) => (
                      <span
                        key={`${label}-${index}`}
                        className={`rounded-md border px-2 py-1 font-mono text-[11px] ${
                          index === 0
                            ? 'border-violet-400/50 bg-violet-500/15 text-violet-200'
                            : 'border-white/10 bg-white/[0.03] text-slate-300'
                        }`}
                      >
                        {label}
                      </span>
                    ))
                  )}
                </div>
                <p className="mt-2 text-[10px] text-slate-500">
                  {mode === 'bfs' ? 'Front of the queue (next to visit) is highlighted.' : 'Top of the stack is highlighted.'}
                </p>
                <div className="mt-3 border-t border-white/[0.06] pt-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Current node</p>
                  <p className="mt-1 text-sm font-semibold text-violet-200">{view.current ?? '—'}</p>
                  {view.lastOp && (
                    <p className="mt-1 font-mono text-[10px] text-slate-400">
                      {view.lastOp.action} {view.lastOp.node}
                      {view.lastOp.from ? ` (from ${view.lastOp.from})` : ''}
                      {view.lastOp.reason ? ` · ${view.lastOp.reason}` : ''}
                    </p>
                  )}
                </div>
              </Card>

              <Card className="p-4">
                <SectionTitle>Visited order</SectionTitle>
                <div className="flex flex-wrap gap-1.5">
                  {result.visited.map((label, index) => (
                    <span
                      key={`${label}-${index}`}
                      className={`rounded-md border px-2 py-0.5 font-mono text-[11px] ${
                        view.visited.has(label)
                          ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-200'
                          : 'border-white/10 bg-white/[0.02] text-slate-500'
                      }`}
                    >
                      {index + 1}. {label}
                    </span>
                  ))}
                </div>
                {result.unreachable.length > 0 && (
                  <p className="mt-3 text-[11px] text-amber-300/90">
                    Unreachable from {start}: {result.unreachable.join(', ')}
                  </p>
                )}
              </Card>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <Card className="p-4 xl:col-span-2">
              <SectionTitle>Operation log</SectionTitle>
              <div className="max-h-72 overflow-y-auto rounded-lg border border-white/[0.06]">
                <table className="table-base">
                  <thead className="sticky top-0 bg-ink-850">
                    <tr>
                      <th>#</th>
                      <th>Action</th>
                      <th>Node</th>
                      <th>Detail</th>
                      <th>{mode === 'bfs' ? 'Queue' : 'Stack'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ops.slice(0, step + 1).map((op, index) => (
                      <tr key={index} className={index === step ? 'bg-violet-500/10' : ''}>
                        <td className="text-slate-500">{index + 1}</td>
                        <td>
                          <span
                            className={`rounded border px-1.5 py-0.5 text-[10px] ${
                              op.action === 'enqueue' || op.action === 'push' || op.action === 'discover'
                                ? 'border-cyan-400/30 bg-cyan-500/10 text-cyan-200'
                                : op.action === 'dequeue' || op.action === 'pop'
                                  ? 'border-violet-400/30 bg-violet-500/10 text-violet-200'
                                  : op.action === 'backtrack'
                                    ? 'border-amber-400/30 bg-amber-500/10 text-amber-200'
                                    : 'border-white/10 bg-white/5 text-slate-400'
                            }`}
                          >
                            {op.action}
                          </span>
                        </td>
                        <td className="font-mono text-xs text-slate-200">{op.node}</td>
                        <td className="text-[11px] text-slate-500">{op.from ? `from ${op.from}` : op.reason ?? '—'}</td>
                        <td className="font-mono text-[10px] text-slate-400">[{(op.queue ?? op.stack ?? []).join(', ')}]</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="p-4">
              <SectionTitle>{mode === 'bfs' ? 'BFS tree' : 'DFS tree'}</SectionTitle>
              <div className="max-h-72 overflow-y-auto space-y-1">
                {treeEdges.length === 0 ? (
                  <p className="text-xs text-slate-500">Only the start node was reached.</p>
                ) : (
                  treeEdges.map((edge) => (
                    <div key={edge} className="rounded border border-white/[0.06] bg-white/[0.02] px-2 py-1 font-mono text-[11px] text-slate-300">
                      {edge}
                    </div>
                  ))
                )}
              </div>
              <div className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 text-[10px] leading-relaxed text-slate-500">
                Tree edges are the parent links recorded during traversal. They form a spanning tree of the reachable component — a
                graph with a cycle will still produce a tree here.
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
