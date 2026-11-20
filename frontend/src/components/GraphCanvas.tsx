import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import type { GraphDetail, GraphEdge } from '../types';

export type NodeVisualState =
  | 'default'
  | 'start'
  | 'end'
  | 'visited'
  | 'path'
  | 'selected'
  | 'reachable'
  | 'unreachable'
  | 'isolated';

type GraphFlowNodeData = {
  label: string;
  state: NodeVisualState;
  degree: number;
};

type GraphFlowNode = Node<GraphFlowNodeData>;

const STATE_STYLES: Record<NodeVisualState, { bg: string; border: string; text: string; shadow: string }> = {
  default: {
    bg: 'bg-[#111a30]',
    border: 'border-slate-500/40',
    text: 'text-slate-200',
    shadow: 'shadow-[0_0_18px_rgba(59,130,246,0.18)]',
  },
  start: {
    bg: 'bg-emerald-500/20',
    border: 'border-emerald-400',
    text: 'text-emerald-100',
    shadow: 'shadow-[0_0_24px_rgba(16,185,129,0.5)]',
  },
  end: {
    bg: 'bg-rose-500/20',
    border: 'border-rose-400',
    text: 'text-rose-100',
    shadow: 'shadow-[0_0_24px_rgba(244,63,94,0.45)]',
  },
  visited: {
    bg: 'bg-cyan-500/15',
    border: 'border-cyan-400/80',
    text: 'text-cyan-100',
    shadow: 'shadow-[0_0_20px_rgba(34,211,238,0.4)]',
  },
  path: {
    bg: 'bg-violet-500/25',
    border: 'border-violet-400',
    text: 'text-violet-50',
    shadow: 'shadow-[0_0_26px_rgba(139,92,246,0.6)]',
  },
  selected: {
    bg: 'bg-white/15',
    border: 'border-white',
    text: 'text-white',
    shadow: 'shadow-[0_0_24px_rgba(255,255,255,0.35)]',
  },
  reachable: {
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-400/70',
    text: 'text-emerald-100',
    shadow: 'shadow-[0_0_18px_rgba(16,185,129,0.35)]',
  },
  unreachable: {
    bg: 'bg-slate-700/40',
    border: 'border-slate-500/40',
    text: 'text-slate-300',
    shadow: 'shadow-none',
  },
  isolated: {
    bg: 'bg-amber-500/15',
    border: 'border-amber-400/70',
    text: 'text-amber-100',
    shadow: 'shadow-[0_0_18px_rgba(245,158,11,0.35)]',
  },
};

function GraphNodeView({ data }: NodeProps<GraphFlowNode>) {
  const style = STATE_STYLES[data.state] ?? STATE_STYLES.default;
  return (
    <div
      className={`flex min-w-[74px] items-center justify-center rounded-xl border px-3 py-2 backdrop-blur-sm transition-all duration-300 ${style.bg} ${style.border} ${style.text} ${style.shadow}`}
    >
      <Handle type="target" position={Position.Top} isConnectable={false} style={{ opacity: 0 }} />
      <span className="max-w-[150px] truncate text-center text-xs font-semibold tracking-wide">{data.label}</span>
      <Handle type="source" position={Position.Bottom} isConnectable={false} style={{ opacity: 0 }} />
    </div>
  );
}

const NODE_TYPES = { graphNode: GraphNodeView };

interface GraphCanvasProps {
  graph: GraphDetail;
  nodeStates?: Record<string, NodeVisualState>;
  activeEdges?: string[];
  height?: number | string;
  editable?: boolean;
  showWeights?: boolean;
  onNodeClick?: (label: string) => void;
  onEdgeClick?: (edge: GraphEdge) => void;
  onPaneClick?: (x: number, y: number) => void;
  onNodeDragStop?: (label: string, x: number, y: number) => void;
  onSelectionChange?: (label: string | null) => void;
  fitSignal?: number;
  className?: string;
}

function CanvasInner({
  graph,
  nodeStates,
  activeEdges = [],
  height = 460,
  editable = false,
  showWeights = true,
  onNodeClick,
  onEdgeClick,
  onPaneClick,
  onNodeDragStop,
  onSelectionChange,
  fitSignal = 0,
}: GraphCanvasProps) {
  const { screenToFlowPosition, fitView } = useReactFlow();
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedEdgeKey, setSelectedEdgeKey] = useState<string | null>(null);

  useEffect(() => {
    setSelected(null);
    setSelectedEdgeKey(null);
  }, [graph.id]);

  useEffect(() => {
    onSelectionChange?.(selected);
  }, [selected, onSelectionChange]);

  useEffect(() => {
    if (!fitSignal) return;
    const timer = window.setTimeout(() => {
      void fitView({ padding: 0.22, duration: 400 });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [fitSignal, fitView]);

  const degreeMap = useMemo(() => {
    const degrees: Record<string, number> = {};
    graph.nodes.forEach((node) => {
      degrees[node.label] = 0;
    });
    graph.edges.forEach((edge) => {
      degrees[edge.source_node] = (degrees[edge.source_node] ?? 0) + 1;
      if (edge.source_node !== edge.target_node) {
        degrees[edge.target_node] = (degrees[edge.target_node] ?? 0) + 1;
      }
    });
    return degrees;
  }, [graph]);

  const nodes = useMemo<GraphFlowNode[]>(
    () =>
      graph.nodes.map((node) => {
        const state: NodeVisualState =
          selected === node.label ? 'selected' : nodeStates?.[node.label] ?? 'default';
        return {
          id: node.label,
          type: 'graphNode',
          position: { x: node.x_position, y: node.y_position },
          data: { label: node.label, state, degree: degreeMap[node.label] ?? 0 },
          draggable: editable && Boolean(onNodeDragStop),
          selectable: editable,
        };
      }),
    [graph.nodes, nodeStates, selected, editable, degreeMap, onNodeDragStop],
  );

  const edges = useMemo<Edge[]>(
    () =>
      graph.edges.map((edge) => {
        const key = `${edge.source_node}|${edge.target_node}`;
        const reverseKey = `${edge.target_node}|${edge.source_node}`;
        const isActive = activeEdges.includes(key) || activeEdges.includes(reverseKey);
        const edgeKey = `${key}|${edge.id}`;
        const isSelected = selectedEdgeKey === edgeKey;
        const stroke = isSelected ? '#f8fafc' : isActive ? '#a78bfa' : graph.directed ? '#3b82f6' : '#334155';
        return {
          id: edgeKey,
          source: edge.source_node,
          target: edge.target_node,
          animated: isActive,
          label: showWeights && graph.weighted ? String(edge.weight) : undefined,
          labelBgPadding: [5, 2] as [number, number],
          labelBgBorderRadius: 4,
          labelBgStyle: { fill: '#0a1020', stroke: isActive ? '#8b5cf6' : '#1e293b', strokeWidth: 1 },
          labelStyle: { fill: isActive ? '#ddd6fe' : '#94a3b8', fontSize: 10, fontWeight: 600 },
          style: {
            stroke,
            strokeWidth: isActive || isSelected ? 2.4 : 1.4,
            filter: isActive ? 'drop-shadow(0 0 6px rgba(139,92,246,0.7))' : undefined,
          },
          markerEnd: graph.directed
            ? { type: MarkerType.ArrowClosed, color: stroke, width: 16, height: 16 }
            : undefined,
        };
      }),
    [graph, activeEdges, selectedEdgeKey, showWeights],
  );

  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      setSelectedEdgeKey(edge.id);
      setSelected(null);
      const dbEdge = graph.edges.find(
        (item) => `${item.source_node}|${item.target_node}|${item.id}` === edge.id,
      );
      if (dbEdge && onEdgeClick) onEdgeClick(dbEdge);
    },
    [graph.edges, onEdgeClick],
  );

  return (
    <div style={{ height }} className="w-full overflow-hidden rounded-xl border border-white/[0.06] bg-ink-950/60">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.24 }}
        minZoom={0.15}
        maxZoom={2.2}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={editable && Boolean(onNodeDragStop)}
        nodesConnectable={false}
        elementsSelectable={editable}
        panOnScroll
        zoomOnDoubleClick={false}
        onNodeClick={(_event, node) => {
          setSelected(node.id);
          setSelectedEdgeKey(null);
          onNodeClick?.(node.id);
        }}
        onEdgeClick={handleEdgeClick}
        onPaneClick={(event) => {
          setSelected(null);
          setSelectedEdgeKey(null);
          if (!onPaneClick) return;
          const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
          onPaneClick(position.x, position.y);
        }}
        onNodeDragStop={(_event, node) => {
          onNodeDragStop?.(node.id, node.position.x, node.position.y);
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="#1e293b" />
        <Controls showInteractive={false} position="bottom-right" />
        {graph.nodes.length <= 120 && (
          <MiniMap
            pannable
            zoomable
            position="top-right"
            maskColor="rgba(5,8,19,0.75)"
            nodeColor="#475569"
            style={{ width: 120, height: 80 }}
          />
        )}
      </ReactFlow>
    </div>
  );
}

export function GraphCanvas(props: GraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <div className={props.className}>
        <CanvasInner {...props} />
      </div>
    </ReactFlowProvider>
  );
}
