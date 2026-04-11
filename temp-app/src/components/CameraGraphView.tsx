"use client";
import React, { useEffect, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  Edge,
  Handle,
  MarkerType,
  Node,
  NodeProps,
  Position,
  useEdgesState,
  useNodesState,
  useReactFlow,
  ReactFlowProvider,
  ConnectionLineType,
} from "reactflow";
import "reactflow/dist/style.css";
import { Camera, CheckCircle2, XCircle, Loader2, Radio } from "lucide-react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
export type CameraStatus = "pending" | "scanning" | "matched" | "clear";

export interface CameraNodeData {
  id: string;
  label: string;
  status: CameraStatus;
  confidence?: number;
  timestamp?: string;
}

export interface CameraGraphViewProps {
  cameras: CameraNodeData[];
  /** Unweighted adjacency list: { "1": [2, 3], "3": [1, 4, 5], ... } */
  graph: Record<string, number[]>;
  pathSequence: number[];
  activeNodeId?: string | null;
}

// ─────────────────────────────────────────────
// Fixed layout for 15-node graph
//
// Graph topology (adjacency):
//   1 → 2,3 | 3 → 4,5 | 4,5 → 6 | 6 → 7
//   7 → 8,9 | 9 → 10,11 | 11 → 12,13 | 13 → 14,15
//
// Visual layout (x,y) — left-to-right tree:
// ─────────────────────────────────────────────
const NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  "1":  { x: 380,  y: 0   },  // root
  "2":  { x: 100,  y: 120 },  // leaf
  "3":  { x: 660,  y: 120 },  // branch
  "4":  { x: 500,  y: 240 },  // branch
  "5":  { x: 820,  y: 240 },  // branch
  "6":  { x: 660,  y: 360 },  // branch
  "7":  { x: 660,  y: 480 },  // branch
  "8":  { x: 440,  y: 600 },  // leaf
  "9":  { x: 880,  y: 600 },  // branch
  "10": { x: 700,  y: 720 },  // leaf
  "11": { x: 1060, y: 720 },  // branch
  "12": { x: 880,  y: 840 },  // leaf
  "13": { x: 1240, y: 840 },  // branch
  "14": { x: 1120, y: 960 },  // leaf
  "15": { x: 1360, y: 960 },  // leaf
};

// ─────────────────────────────────────────────
// Status → Visual Style
// ─────────────────────────────────────────────
const STATUS_STYLES: Record<CameraStatus, {
  border: string; bg: string; icon: string; glow: string; text: string;
}> = {
  pending:  { border: "#374151", bg: "#111827", icon: "#6B7280", glow: "none",                                  text: "#6B7280" },
  scanning: { border: "#FBBF24", bg: "#1c1800", icon: "#FBBF24", glow: "0 0 20px rgba(251,191,36,0.65)",         text: "#FBBF24" },
  matched:  { border: "#10B981", bg: "#021409", icon: "#10B981", glow: "0 0 24px rgba(16,185,129,0.75)",          text: "#10B981" },
  clear:    { border: "#374151", bg: "#0d1117", icon: "#4B5563", glow: "none",                                  text: "#4B5563" },
};

// ─────────────────────────────────────────────
// Custom Camera Node
// ─────────────────────────────────────────────
function CameraNode({ data }: NodeProps<CameraNodeData>) {
  const s = STATUS_STYLES[data.status];

  return (
    <div
      style={{
        border:       `2px solid ${s.border}`,
        background:   s.bg,
        boxShadow:    s.glow,
        borderRadius: 12,
        padding:      "8px 12px",
        minWidth:     120,
        position:     "relative",
        transition:   "all 0.4s ease",
      }}
    >
      <Handle type="target" position={Position.Top}    style={{ background: s.border, width: 7, height: 7 }} />
      <Handle type="target" position={Position.Left}   style={{ background: s.border, width: 7, height: 7 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: s.border, width: 7, height: 7 }} />
      <Handle type="source" position={Position.Right}  style={{ background: s.border, width: 7, height: 7 }} />

      {/* Scan ring */}
      {data.status === "scanning" && (
        <span style={{
          position: "absolute", inset: -6, borderRadius: 16,
          border: "2px solid #FBBF24",
          animation: "ping 1.2s cubic-bezier(0,0,0.2,1) infinite",
        }} />
      )}

      {/* Node header */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
        <Camera size={11} color={s.icon} />
        <span style={{ color: s.icon, fontFamily: "monospace", fontSize: 9, fontWeight: 700 }}>
          CAM {data.id}
        </span>
        {data.status === "matched"  && <CheckCircle2 size={11} color="#10B981" />}
        {data.status === "scanning" && <Loader2      size={11} color="#FBBF24" style={{ animation: "spin 1s linear infinite" }} />}
        {data.status === "clear"    && <XCircle      size={11} color="#4B5563" />}
      </div>

      <p style={{ color: s.text, fontSize: 10, fontWeight: 600, margin: 0, lineHeight: 1.3 }}>
        {data.label}
      </p>

      {data.status === "matched" && data.confidence !== undefined && (
        <p style={{ color: "#10B981", fontSize: 8, fontFamily: "monospace", marginTop: 2 }}>
          {(data.confidence * 100).toFixed(1)}%
        </p>
      )}

      {data.status === "matched" && data.timestamp && (
        <p style={{ color: "#374151", fontSize: 8, fontFamily: "monospace" }}>
          {data.timestamp}
        </p>
      )}
    </div>
  );
}

const nodeTypes = { camera: CameraNode };

// ─────────────────────────────────────────────
// Inner React Flow component
// ─────────────────────────────────────────────
function FlowGraph({ cameras, graph, pathSequence, activeNodeId }: CameraGraphViewProps) {
  const { fitView } = useReactFlow();

  // Derive camera lookup map
  const camMap = useMemo(() => {
    const m: Record<string, CameraNodeData> = {};
    for (const c of cameras) m[c.id] = c;
    return m;
  }, [cameras]);

  // Path edge set for highlighting: "1-3", "3-4" ...
  const pathEdgeSet = useMemo(() => {
    const s = new Set<string>();
    for (let i = 0; i < pathSequence.length - 1; i++) {
      s.add(`${pathSequence[i]}-${pathSequence[i + 1]}`);
    }
    return s;
  }, [pathSequence]);

  // Build React Flow nodes
  const initialNodes: Node<CameraNodeData>[] = useMemo(() => {
    const result: Node<CameraNodeData>[] = [];
    for (const [camId, pos] of Object.entries(NODE_POSITIONS)) {
      const cam = camMap[camId];
      result.push({
        id:       camId,
        type:     "camera",
        position: pos,
        data:     cam || { id: camId, label: `Camera ${camId}`, status: "pending" },
        selected: camId === activeNodeId,
      });
    }
    return result;
  }, [camMap, activeNodeId]);

  // Build React Flow edges (deduplicate undirected pairs)
  const initialEdges: Edge[] = useMemo(() => {
    const seen = new Set<string>();
    const result: Edge[] = [];

    for (const [from, neighbors] of Object.entries(graph)) {
      for (const to of neighbors) {
        const toStr     = String(to);
        const canonical = [from, toStr].sort().join("-");
        const isPath    = pathEdgeSet.has(`${from}-${toStr}`);

        // Don't skip path edges even if already seen
        if (seen.has(canonical) && !isPath) continue;
        seen.add(canonical);

        result.push({
          id:       `e-${from}-${toStr}`,
          source:   from,
          target:   toStr,
          type:     "smoothstep",
          animated: isPath,
          style: {
            stroke:      isPath ? "#10B981" : "#1e293b",
            strokeWidth: isPath ? 3 : 1.5,
          },
          markerEnd: {
            type:   MarkerType.ArrowClosed,
            color:  isPath ? "#10B981" : "#374151",
            width:  10,
            height: 10,
          },
        });
      }
    }
    return result;
  }, [graph, pathEdgeSet]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  // Fit view after mount
  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.15, duration: 500 }), 150);
    return () => clearTimeout(t);
  }, [fitView]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      connectionLineType={ConnectionLineType.SmoothStep}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      proOptions={{ hideAttribution: true }}
      style={{ background: "transparent" }}
    >
      <Background color="#1e293b" gap={32} size={1} />
      <Controls
        style={{
          background:   "#0f172a",
          border:       "1px solid #1e293b",
          borderRadius: 10,
        }}
      />
    </ReactFlow>
  );
}

// ─────────────────────────────────────────────
// Legend helpers
// ─────────────────────────────────────────────
function LegendDot({ color, label, pulse }: { color: string; label: string; pulse?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{
        display: "inline-block", width: 8, height: 8, borderRadius: 2,
        background: color,
        boxShadow: `0 0 5px ${color}`,
        animation: pulse ? "pulse 1.5s ease-in-out infinite" : "none",
      }} />
      <span style={{ color: "#94a3b8", fontSize: 11 }}>{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Exported component (wraps ReactFlowProvider)
// ─────────────────────────────────────────────
export default function CameraGraphView(props: CameraGraphViewProps) {
  const { pathSequence } = props;

  const pathString = pathSequence.length > 0
    ? pathSequence.join(" → ")
    : "Awaiting traversal...";

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", position: "relative" }}>
      {/* Path breadcrumb */}
      <div style={{
        position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)",
        zIndex: 10, background: "rgba(2,6,23,0.9)", backdropFilter: "blur(16px)",
        border: "1px solid rgba(100,116,139,0.3)", borderRadius: 20,
        padding: "6px 18px", display: "flex", alignItems: "center", gap: 8,
        boxShadow: "0 4px 24px rgba(0,0,0,0.4)", maxWidth: "90%", overflow: "hidden",
      }}>
        <Radio size={11} color="#34d399" style={{ flexShrink: 0, animation: pathSequence.length > 0 ? "pulse 2s ease infinite" : "none" }} />
        <span style={{ fontFamily: "monospace", fontSize: 11, color: "#34d399", fontWeight: 700, letterSpacing: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          PATH: {pathString}
        </span>
      </div>

      {/* Legend */}
      <div style={{
        position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)",
        zIndex: 10, background: "rgba(2,6,23,0.85)", backdropFilter: "blur(16px)",
        border: "1px solid rgba(100,116,139,0.3)", borderRadius: 20,
        padding: "6px 16px", display: "flex", alignItems: "center", gap: 16,
        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
      }}>
        <LegendDot color="#10B981" label="Matched" />
        <div style={{ width: 1, height: 12, background: "#334155" }} />
        <LegendDot color="#FBBF24" label="Scanning" pulse />
        <div style={{ width: 1, height: 12, background: "#334155" }} />
        <LegendDot color="#374151" label="Pending" />
        <div style={{ width: 1, height: 12, background: "#334155" }} />
        <LegendDot color="#4B5563" label="Clear" />
      </div>

      {/* React Flow */}
      <ReactFlowProvider>
        <div style={{ flex: 1 }}>
          <FlowGraph {...props} />
        </div>
      </ReactFlowProvider>

      {/* CSS animations */}
      <style>{`
        @keyframes ping  { 75%,100% { transform: scale(1.5); opacity: 0; } }
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        .react-flow__node { cursor: default !important; }
        .react-flow__controls button {
          background: #0f172a !important;
          border-color: #1e293b !important;
          color: #94a3b8 !important;
        }
        .react-flow__controls button:hover { background: #1e293b !important; }
        .react-flow__attribution { display: none; }
      `}</style>
    </div>
  );
}
