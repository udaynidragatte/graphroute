import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CircleDot,
  Eraser,
  GitBranch,
  Grid3x3,
  Info,
  LayoutGrid,
  Link2,
  Maximize2,
  MousePointer2,
  Pencil,
  Plus,
  Redo2,
  Share2,
  Trash2,
  Undo2,
  Workflow,
} from 'lucide-react';
import { GraphCanvas, type NodeVisualState } from '../components/GraphCanvas';
import {
  Badge,
  Card,
  ConfirmDialog,
  EmptyState,
  LoadingBlock,
  Modal,
  PageHeader,
  SectionTitle,
} from '../components/ui';
import { useToast } from '../components/Toast';
import { useGraph } from '../hooks/useGraph';
import { useSettings } from '../hooks/useSettings';
import {
  addEdge,
  addNode,
  apiError,
  deleteEdge,
  deleteNode,
  exportGraphText,
  patchNode,
  replaceStructure,
  resetGraph,
  updateEdge,
  updateGraph,
} from '../services/api';
import { computeLayout, type LayoutKind } from '../graph/layout';
import { downloadFile, edgeKey, formatWeight } from '../lib/format';
import type { GraphDetail, GraphEdge } from '../types';

type Mode = 'select' | 'addNode' | 'addEdge' | 'delete';

interface Snapshot {
  nodes: { label: string; x_position: number; y_position: number; metadata: Record<string, unknown> }[];
  edges: { source_node: string; target_node: string; weight: number }[];
}

type EdgeDialog =
  | { mode: 'add'; source: string; target: string }
  | { mode: 'edit'; edge: GraphEdge }
  | null;

const snapshotOf = (graph: GraphDetail): Snapshot => ({
  nodes: graph.nodes.map((node) => ({
    label: node.label,
    x_position: node.x_position,
    y_position: node.y_position,
    metadata: node.metadata ?? {},
  })),
  edges: graph.edges.map((edge) => ({
    source_node: edge.source_node,
    target_node: edge.target_node,
    weight: edge.weight,
  })),
});

const LAYOUTS: { value: LayoutKind; label: string; icon: typeof Grid3x3 }[] = [
  { value: 'force', label: 'Force-directed', icon: Share2 },
  { value: 'circular', label: 'Circular', icon: CircleDot },
  { value: 'hierarchical', label: 'Hierarchical', icon: GitBranch },
  { value: 'grid', label: 'Grid', icon: LayoutGrid },
];

const MODE_HELP: Record<Mode, string> = {
  select: 'Select mode — click a node to inspect it, click an edge to edit its weight, drag nodes to reposition.',
  addNode: 'Add node mode — click anywhere on the empty canvas to place a new node.',
  addEdge: 'Add edge mode — click a source node, then a target node. A weight dialog will open.',
  delete: 'Delete mode — click a node or edge to remove it. Incidents are removed with the node.',
};

export default function GraphVisualizer() {
  const { graph, loading, setGraph } = useGraph();
  const { preferences, update } = useSettings();
  const toast = useToast();

  const [mode, setMode] = useState<Mode>('select');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);
  const [edgeSource, setEdgeSource] = useState<string | null>(null);
  const [layout, setLayout] = useState<LayoutKind>('force');
  const [fitSignal, setFitSignal] = useState(0);
  const [showWeights, setShowWeights] = useState(preferences.showEdgeWeights);
  const [busy, setBusy] = useState(false);
  const [timeline, setTimeline] = useState<{ snaps: Snapshot[]; index: number }>({ snaps: [], index: 0 });

  const [nodePosition, setNodePosition] = useState<{ x: number; y: number } | null>(null);
  const [nodeLabel, setNodeLabel] = useState('');
  const [edgeDialog, setEdgeDialog] = useState<EdgeDialog>(null);
  const [weightInput, setWeightInput] = useState('1');
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'node' | 'edge'; label?: string; edge?: GraphEdge } | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');

  useEffect(() => {
    if (!graph) return;
    setTimeline({ snaps: [snapshotOf(graph)], index: 0 });
    setSelectedNode(null);
    setSelectedEdge(null);
    setEdgeSource(null);
    setMode('select');
  }, [graph?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const record = useCallback((next: GraphDetail) => {
    const snap = snapshotOf(next);
    setTimeline((prev) => {
      const snaps = [...prev.snaps.slice(0, prev.index + 1), snap].slice(-30);
      return { snaps, index: snaps.length - 1 };
    });
  }, []);

  const mutate = useCallback(
    async (action: () => Promise<GraphDetail>, message: string, silent = false) => {
      setBusy(true);
      try {
        const next = await action();
        setGraph(next);
        record(next);
        if (!silent) toast.success(message);
        return next;
      } catch (err) {
        toast.error(apiError(err));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [record, setGraph, toast],
  );

  const nodeStates = useMemo<Record<string, NodeVisualState>>(() => {
    const states: Record<string, NodeVisualState> = {};
    if (edgeSource) states[edgeSource] = 'start';
    return states;
  }, [edgeSource]);

  if (loading && !graph) {
    return (
      <Card className="p-6">
        <LoadingBlock label="Loading graph…" height={300} />
      </Card>
    );
  }
  if (!graph) {
    return (
      <Card>
        <EmptyState
          icon={<Workflow className="h-5 w-5" />}
          title="Nothing to visualize yet"
          message="Select or create a graph in Graph Management first."
          action={
            <Link to="/graphs" className="btn-primary">
              Go to Graph Management
            </Link>
          }
        />
      </Card>
    );
  }

  const neighbours = selectedNode
    ? graph.edges
        .filter((edge) => edge.source_node === selectedNode || edge.target_node === selectedNode)
        .map((edge) => ({
          other: edge.source_node === selectedNode ? edge.target_node : edge.source_node,
          weight: edge.weight,
          direction: edge.source_node === selectedNode ? '→' : graph.directed ? '←' : '—',
        }))
    : [];

  const handleNodeClick = (label: string) => {
    if (mode === 'delete') {
      setDeleteTarget({ type: 'node', label });
      return;
    }
    if (mode === 'addEdge') {
      if (!edgeSource) {
        setEdgeSource(label);
        toast.info(`Source selected: ${label}. Now click the target node.`);
        return;
      }
      if (edgeSource === label) {
        toast.warning('Self-loops are not allowed — pick a different target.');
        return;
      }
      setEdgeDialog({ mode: 'add', source: edgeSource, target: label });
      setWeightInput(graph.weighted ? '1' : '1');
      setEdgeSource(null);
    }
  };

  const handleEdgeClick = (edge: GraphEdge) => {
    setSelectedEdge(edge);
    if (mode === 'delete') {
      setDeleteTarget({ type: 'edge', edge });
      return;
    }
    if (mode === 'select') {
      setEdgeDialog({ mode: 'edit', edge });
      setWeightInput(String(edge.weight));
    }
  };

  const handlePaneClick = (x: number, y: number) => {
    if (mode !== 'addNode') return;
    setNodePosition({ x, y });
    setNodeLabel(`Node ${graph.nodes.length + 1}`);
  };

  const handleDragStop = async (label: string, x: number, y: number) => {
    const next = await mutate(() => patchNode(graph.id, label, { x_position: x, y_position: y }), '', true);
    if (next) toast.info(`Position of “${label}” saved`);
  };

  const submitNode = async () => {
    if (!nodePosition || !nodeLabel.trim()) return;
    const next = await mutate(
      () =>
        addNode(graph.id, {
          label: nodeLabel.trim(),
          x_position: nodePosition.x,
          y_position: nodePosition.y,
          metadata: {},
        }),
      `Node “${nodeLabel.trim()}” added`,
    );
    if (next) {
      setNodePosition(null);
      setMode('select');
    }
  };

  const submitEdge = async () => {
    if (!edgeDialog) return;
    const weight = Number(weightInput);
    if (!Number.isFinite(weight)) {
      toast.error('Weights must be numbers');
      return;
    }
    if (edgeDialog.mode === 'add') {
      const next = await mutate(
        () =>
          addEdge(graph.id, {
            source_node: edgeDialog.source,
            target_node: edgeDialog.target,
            weight,
          }),
        `Edge ${edgeDialog.source} ${graph.directed ? '→' : '—'} ${edgeDialog.target} created`,
      );
      if (next) setEdgeDialog(null);
    } else {
      const edge = edgeDialog.edge;
      const next = await mutate(
        () => updateEdge(graph.id, edge.id, weight),
        `Weight updated to ${formatWeight(weight)}`,
      );
      if (next) setEdgeDialog(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'node' && deleteTarget.label) {
      const label = deleteTarget.label;
      await mutate(() => deleteNode(graph.id, label), `Node “${label}” deleted`);
    } else if (deleteTarget.type === 'edge' && deleteTarget.edge) {
      const edge = deleteTarget.edge;
      await mutate(
        () => deleteEdge(graph.id, edge.source_node, edge.target_node),
        `Edge ${edge.source_node} → ${edge.target_node} deleted`,
      );
    }
    setDeleteTarget(null);
    setSelectedNode(null);
    setSelectedEdge(null);
  };

  const applyLayout = async (kind: LayoutKind) => {
    setLayout(kind);
    const positions = computeLayout(kind, graph.nodes, graph.edges);
    const next = await mutate(
      () =>
        replaceStructure(graph.id, {
          nodes: graph.nodes.map((node) => ({
            label: node.label,
            x_position: positions[node.label]?.x ?? node.x_position,
            y_position: positions[node.label]?.y ?? node.y_position,
            metadata: node.metadata ?? {},
          })),
          edges: graph.edges.map((edge) => ({
            source_node: edge.source_node,
            target_node: edge.target_node,
            weight: edge.weight,
          })),
        }),
      `${LAYOUTS.find((item) => item.value === kind)?.label} layout applied`,
    );
    if (next) setFitSignal((value) => value + 1);
  };

  const undo = async () => {
    if (timeline.index <= 0) return;
    const target = timeline.snaps[timeline.index - 1];
    setBusy(true);
    try {
      const next = await replaceStructure(graph.id, target);
      setGraph(next);
      setTimeline((prev) => ({ ...prev, index: prev.index - 1 }));
      toast.info('Undo applied');
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const redo = async () => {
    if (timeline.index >= timeline.snaps.length - 1) return;
    const target = timeline.snaps[timeline.index + 1];
    setBusy(true);
    try {
      const next = await replaceStructure(graph.id, target);
      setGraph(next);
      setTimeline((prev) => ({ ...prev, index: prev.index + 1 }));
      toast.info('Redo applied');
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleDirected = async () => {
    await mutate(() => updateGraph(graph.id, { directed: !graph.directed }), `Graph is now ${graph.directed ? 'undirected' : 'directed'}`);
  };

  const toggleWeighted = async () => {
    await mutate(
      () => updateGraph(graph.id, { weighted: !graph.weighted }),
      `Graph is now ${graph.weighted ? 'unweighted (all weights = 1)' : 'weighted'}`,
    );
  };

  const exportJson = async () => {
    try {
      const data = await exportGraphText(graph.id);
      downloadFile(`${graph.name.replace(/\s+/g, '-').toLowerCase()}.json`, JSON.stringify(data, null, 2));
      toast.success('Graph exported as JSON');
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const applyImport = async () => {
    try {
      const parsed = JSON.parse(importText) as {
        nodes?: { label: string; x_position?: number; y_position?: number; metadata?: Record<string, unknown> }[];
        edges?: { source_node: string; target_node: string; weight?: number }[];
      };
      if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
        throw new Error('JSON must contain "nodes" and "edges" arrays');
      }
      const next = await mutate(
        () =>
          replaceStructure(graph.id, {
            nodes: parsed.nodes!.map((node, index) => ({
              label: node.label,
              x_position: node.x_position ?? 120 + (index % 6) * 150,
              y_position: node.y_position ?? 100 + Math.floor(index / 6) * 120,
              metadata: node.metadata ?? {},
            })),
            edges: parsed.edges!.map((edge) => ({
              source_node: edge.source_node,
              target_node: edge.target_node,
              weight: edge.weight ?? 1,
            })),
          }),
        'Graph structure imported',
      );
      if (next) {
        setImportOpen(false);
        setImportText('');
        setFitSignal((value) => value + 1);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invalid JSON');
    }
  };

  const clearGraph = async () => {
    setBusy(true);
    try {
      const next = await resetGraph(graph.id);
      setGraph(next);
      setTimeline({ snaps: [snapshotOf(next)], index: 0 });
      toast.success('Graph cleared');
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(false);
      setClearOpen(false);
    }
  };

  const LayoutIcon = LAYOUTS.find((item) => item.value === layout)?.icon ?? Share2;

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title="Graph Visualizer"
        subtitle={`Editing “${graph.name}”. Add nodes, connect them, adjust weights and lay out the network — every change is persisted to SQLite.`}
        actions={
          <>
            <Badge tone="violet">{graph.directed ? 'Directed' : 'Undirected'}</Badge>
            <Badge tone="cyan">{graph.weighted ? 'Weighted' : 'Unweighted'}</Badge>
            <button className="btn-ghost" onClick={() => setFitSignal((value) => value + 1)}>
              <Maximize2 className="h-4 w-4" /> Fit
            </button>
          </>
        }
      />

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-white/10 bg-ink-800/60 p-1">
            {[
              { value: 'select' as Mode, label: 'Select', icon: MousePointer2 },
              { value: 'addNode' as Mode, label: 'Add Node', icon: Plus },
              { value: 'addEdge' as Mode, label: 'Add Edge', icon: Link2 },
              { value: 'delete' as Mode, label: 'Delete', icon: Trash2 },
            ].map((item) => (
              <button
                key={item.value}
                onClick={() => {
                  setMode(item.value);
                  setEdgeSource(null);
                }}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                  mode === item.value ? 'bg-gradient-to-r from-violet-500/30 to-blue-500/25 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            ))}
          </div>

          <div className="h-6 w-px bg-white/10" />

          <button className="btn-ghost !px-2.5 !py-1.5" onClick={() => void undo()} disabled={timeline.index <= 0 || busy} title="Undo">
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            className="btn-ghost !px-2.5 !py-1.5"
            onClick={() => void redo()}
            disabled={timeline.index >= timeline.snaps.length - 1 || busy}
            title="Redo"
          >
            <Redo2 className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-1.5">
            <LayoutIcon className="h-3.5 w-3.5 text-slate-500" />
            <select
              value={layout}
              onChange={(event) => void applyLayout(event.target.value as LayoutKind)}
              className="field w-auto py-1.5 text-xs"
              aria-label="Graph layout"
            >
              {LAYOUTS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              onClick={toggleDirected}
              disabled={busy}
              className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${
                graph.directed
                  ? 'border-blue-400/40 bg-blue-500/15 text-blue-200'
                  : 'border-white/10 bg-white/[0.03] text-slate-400'
              }`}
            >
              {graph.directed ? 'Directed' : 'Undirected'}
            </button>
            <button
              onClick={toggleWeighted}
              disabled={busy}
              className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${
                graph.weighted
                  ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200'
                  : 'border-white/10 bg-white/[0.03] text-slate-400'
              }`}
            >
              {graph.weighted ? 'Weighted' : 'Unweighted'}
            </button>
            <button
              onClick={() => {
                setShowWeights((value) => !value);
                update('showEdgeWeights', !showWeights);
              }}
              className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${
                showWeights ? 'border-violet-400/40 bg-violet-500/15 text-violet-200' : 'border-white/10 bg-white/[0.03] text-slate-400'
              }`}
            >
              Weights {showWeights ? 'on' : 'off'}
            </button>
            <button className="btn-ghost !px-2.5 !py-1.5" onClick={() => void exportJson()} title="Export JSON">
              <ArrowDownToLine className="h-4 w-4" />
            </button>
            <button className="btn-ghost !px-2.5 !py-1.5" onClick={() => setImportOpen(true)} title="Import JSON">
              <ArrowUpFromLine className="h-4 w-4" />
            </button>
            <button className="btn-danger !px-2.5 !py-1.5" onClick={() => setClearOpen(true)} title="Clear graph">
              <Eraser className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-2 flex items-start gap-2 rounded-lg bg-white/[0.02] px-3 py-2 text-[11px] text-slate-400">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400" />
          {MODE_HELP[mode]}
          {mode === 'addEdge' && edgeSource && (
            <span className="ml-1 text-cyan-300">Source: {edgeSource}</span>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-4">
        <Card className="relative overflow-hidden p-3 xl:col-span-3">
          {graph.nodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              <div className="rounded-xl border border-white/10 bg-ink-950/85 px-5 py-4 text-center backdrop-blur">
                <p className="text-sm font-medium text-slate-200">The canvas is empty</p>
                <p className="mt-1 text-xs text-slate-500">Switch to “Add Node” and click anywhere to begin.</p>
              </div>
            </div>
          )}
          <GraphCanvas
            graph={graph}
            height={preferences.canvasHeight}
            editable
            showWeights={showWeights && graph.weighted}
            nodeStates={nodeStates}
            activeEdges={selectedEdge ? [edgeKey(selectedEdge.source_node, selectedEdge.target_node)] : []}
            onNodeClick={handleNodeClick}
            onEdgeClick={handleEdgeClick}
            onPaneClick={handlePaneClick}
            onNodeDragStop={(label, x, y) => void handleDragStop(label, x, y)}
            onSelectionChange={setSelectedNode}
            fitSignal={fitSignal}
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-slate-500">
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" /> source</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-400" /> destination</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-violet-400" /> selected</span>
            </span>
            <span>
              {graph.nodes.length} nodes · {graph.edges.length} edges · undo steps {timeline.index}/{Math.max(timeline.snaps.length - 1, 0)}
            </span>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <SectionTitle>Inspector</SectionTitle>
            {selectedNode ? (
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Node</span>
                  <span className="font-medium text-white">{selectedNode}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Degree</span>
                  <span className="text-slate-200">{neighbours.length}</span>
                </div>
                <div>
                  <p className="mb-1 text-slate-500">Adjacency</p>
                  <div className="max-h-32 space-y-1 overflow-y-auto pr-1">
                    {neighbours.length === 0 && <p className="text-slate-500">Isolated node</p>}
                    {neighbours.map((item) => (
                      <div key={`${item.other}-${item.weight}`} className="flex items-center justify-between rounded bg-white/[0.03] px-2 py-1">
                        <span className="text-slate-300">
                          {item.direction} {item.other}
                        </span>
                        {graph.weighted && <span className="font-mono text-[10px] text-cyan-300">{formatWeight(item.weight)}</span>}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Link to="/hashing" className="btn-ghost flex-1 !py-1.5 !text-[11px]">
                    Hash lookup
                  </Link>
                  <button className="btn-danger !py-1.5 !text-[11px]" onClick={() => setDeleteTarget({ type: 'node', label: selectedNode })}>
                    Delete
                  </button>
                </div>
              </div>
            ) : selectedEdge ? (
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Edge</span>
                  <span className="text-slate-200">
                    {selectedEdge.source_node} {graph.directed ? '→' : '—'} {selectedEdge.target_node}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Weight</span>
                  <span className="font-mono text-cyan-300">{formatWeight(selectedEdge.weight)}</span>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    className="btn-ghost flex-1 !py-1.5 !text-[11px]"
                    onClick={() => {
                      setEdgeDialog({ mode: 'edit', edge: selectedEdge });
                      setWeightInput(String(selectedEdge.weight));
                    }}
                  >
                    <Pencil className="h-3 w-3" /> Edit weight
                  </button>
                  <button className="btn-danger !py-1.5 !text-[11px]" onClick={() => setDeleteTarget({ type: 'edge', edge: selectedEdge })}>
                    Delete
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs leading-relaxed text-slate-500">
                Click a node or edge on the canvas to inspect it. Drag nodes to reposition; coordinates are saved to the database.
              </p>
            )}
          </Card>

          <Card className="p-4">
            <SectionTitle>Graph settings</SectionTitle>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Name</span>
                <span className="truncate text-slate-200">{graph.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Type</span>
                <span className="text-slate-200">{graph.directed ? 'Directed' : 'Undirected'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Density</span>
                <span className="text-slate-200">
                  {graph.nodes.length > 1
                    ? `${(((graph.directed ? 1 : 2) * graph.edges.length * 100) / (graph.nodes.length * (graph.nodes.length - 1))).toFixed(1)}%`
                    : '0%'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Total weight</span>
                <span className="text-slate-200">{formatWeight(graph.edges.reduce((sum, edge) => sum + edge.weight, 0))}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={nodePosition !== null}
        title="Add node"
        onClose={() => setNodePosition(null)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setNodePosition(null)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={() => void submitNode()} disabled={busy || !nodeLabel.trim()}>
              <Plus className="h-4 w-4" /> Add node
            </button>
          </>
        }
      >
        <label className="label" htmlFor="node-label">
          Node label
        </label>
        <input
          id="node-label"
          className="field"
          value={nodeLabel}
          autoFocus
          maxLength={80}
          onChange={(event) => setNodeLabel(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void submitNode();
          }}
        />
        <p className="mt-2 text-xs text-slate-500">
          Position: x = {nodePosition?.x.toFixed(0)}, y = {nodePosition?.y.toFixed(0)}. Labels must be unique within a graph.
        </p>
      </Modal>

      <Modal
        open={edgeDialog !== null}
        title={edgeDialog?.mode === 'edit' ? 'Edit edge weight' : 'Create edge'}
        onClose={() => setEdgeDialog(null)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setEdgeDialog(null)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={() => void submitEdge()} disabled={busy}>
              {edgeDialog?.mode === 'edit' ? 'Save weight' : 'Create edge'}
            </button>
          </>
        }
      >
        {edgeDialog && (
          <>
            <p className="mb-3 text-sm text-slate-300">
              {edgeDialog.mode === 'add' ? (
                <>
                  {edgeDialog.source} <span className="text-violet-300">{graph.directed ? '→' : '—'}</span> {edgeDialog.target}
                </>
              ) : (
                <>
                  {edgeDialog.edge.source_node} <span className="text-violet-300">{graph.directed ? '→' : '—'}</span> {edgeDialog.edge.target_node}
                </>
              )}
            </p>
            {!graph.weighted ? (
              <p className="rounded-lg border border-amber-400/20 bg-amber-500/5 p-3 text-xs text-amber-200">
                This graph is unweighted, so the weight stays at 1. Enable weighted mode in the toolbar first.
              </p>
            ) : (
              <>
                <label className="label" htmlFor="edge-weight">
                  Weight
                </label>
                <input
                  id="edge-weight"
                  type="number"
                  step="any"
                  className="field"
                  value={weightInput}
                  autoFocus
                  onChange={(event) => setWeightInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void submitEdge();
                  }}
                />
                <p className="mt-2 text-xs text-slate-500">
                  Negative weights are allowed for Bellman-Ford demos; Dijkstra refuses them.
                </p>
              </>
            )}
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Delete ${deleteTarget?.type ?? 'item'}?`}
        message={
          deleteTarget?.type === 'node'
            ? `Deleting “${deleteTarget.label}” also removes every edge connected to it. This cannot be undone from the database, but you can use Undo afterwards.`
            : `Delete edge ${deleteTarget?.edge?.source_node ?? ''} → ${deleteTarget?.edge?.target_node ?? ''}?`
        }
        confirmLabel="Delete"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />

      <ConfirmDialog
        open={clearOpen}
        title="Clear the entire graph?"
        message="All nodes and edges in this graph are deleted. The graph record itself, its name and description are kept. Consider exporting first."
        confirmLabel="Clear graph"
        danger
        onCancel={() => setClearOpen(false)}
        onConfirm={() => void clearGraph()}
      />

      <Modal
        open={importOpen}
        title="Import graph JSON"
        width="max-w-2xl"
        onClose={() => setImportOpen(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setImportOpen(false)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={() => void applyImport()} disabled={busy || !importText.trim()}>
              Replace graph
            </button>
          </>
        }
      >
        <p className="mb-2 text-xs text-slate-400">
          Paste an exported graph. The current graph’s nodes and edges are replaced (the graph name is kept). To create a
          separate graph from JSON, use Graph Management → Import.
        </p>
        <textarea
          className="field h-64 font-mono text-xs"
          placeholder={'{\n  "nodes": [{"label": "A", "x_position": 100, "y_position": 100}],\n  "edges": []\n}'}
          value={importText}
          onChange={(event) => setImportText(event.target.value)}
        />
      </Modal>
    </div>
  );
}
