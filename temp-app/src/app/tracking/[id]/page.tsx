"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Route, Car, User, Loader2, Clock,
  CheckCircle2, XCircle, ChevronRight, Network, Radio,
  AlertTriangle, MonitorPlay
} from "lucide-react";
import type { CameraNodeData } from "../../../components/CameraGraphView";

// Dynamic import to avoid SSR issues with React Flow
const CameraGraphView = dynamic(
  () => import("../../../components/CameraGraphView"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-slate-900/40">
        <Loader2 className="animate-spin text-blue-500" size={36} />
        <p className="text-xs font-mono text-slate-500">Loading graph engine...</p>
      </div>
    ),
  }
);

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface TrackingHit {
  camera_id: string;
  label: string;
  timestamp: string;
  confidence: number;
  frame_b64: string | null;
  demo_mode?: boolean;
}

function formatTs(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    });
  } catch { return iso; }
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────
export default function TrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);

  // ── Graph state ─────────────────────────────────────
  const [cameras,      setCameras]      = useState<CameraNodeData[]>([]);
  const [cameraGraph,  setCameraGraph]  = useState<Record<string, number[]>>({});
  const [pathSequence, setPathSequence] = useState<number[]>([]);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [graphReady,   setGraphReady]   = useState(false);

  // ── Tracking results ────────────────────────────────
  const [trackingPath,    setTrackingPath]    = useState<TrackingHit[]>([]);
  const [selectedHit,     setSelectedHit]     = useState<TrackingHit | null>(null);
  const [mode,            setMode]            = useState<"person" | "vehicle">("person");

  // ── UI state ────────────────────────────────────────
  const [isScanning,      setIsScanning]      = useState(true);
  const [pipelinePhase,   setPipelinePhase]   = useState<"init" | "encoding" | "tracking" | "done">("init");
  const [scanStatus,      setScanStatus]      = useState("Loading camera network...");
  const [camerasScanCount,setCamerasScanCount] = useState(0);
  const [systemLog,       setSystemLog]       = useState<{ time: string; msg: string; type: string }[]>([]);

  const animationTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const addLog = useCallback((msg: string, type: "INFO" | "MATCH" | "WARN" | "SYS" = "INFO") => {
    setSystemLog(prev => [{
      time: new Date().toLocaleTimeString("en-IN", { hour12: false }),
      msg, type,
    }, ...prev].slice(0, 60));
  }, []);

  // Helper: build camera node array from raw metadata
  const buildCameraNodes = useCallback(
    (rawCameras: any[], overrides: Record<string, CameraNodeData["status"]> = {}): CameraNodeData[] => {
      return rawCameras.map(c => ({
        id:     c.id,
        label:  c.label,
        status: overrides[c.id] ?? ("pending" as const),
      }));
    },
    []
  );

  // ── PHASE 1: Load graph immediately on mount ─────────────────
  useEffect(() => {
    async function preloadGraph() {
      try {
        setScanStatus("Loading camera network graph...");
        const res  = await fetch("/api/cameras");
        const data = await res.json();

        if (data.success) {
          setCameraGraph(data.graph);
          setCameras(buildCameraNodes(data.cameras));
          setGraphReady(true);
          addLog(`Camera network loaded: ${data.node_count} nodes, ${data.edge_count} edges`, "SYS");
          setScanStatus(`Graph loaded — ${data.node_count} camera nodes ready`);
        } else {
          addLog("Graph load failed — using fallback", "WARN");
          // Fallback: generate 15 stubs
          const fallbackCams = Array.from({ length: 15 }, (_, i) => ({
            id: String(i + 1), label: `Camera ${i + 1}`,
          }));
          setCameras(buildCameraNodes(fallbackCams));
          setCameraGraph({
            "1": [2,3], "2": [1], "3": [1,4,5], "4": [3,6], "5": [3,6],
            "6": [4,5,7], "7": [6,8,9], "8": [7], "9": [7,10,11], "10": [9],
            "11": [9,12,13], "12": [11], "13": [11,14,15], "14": [13], "15": [13],
          });
          setGraphReady(true);
        }
      } catch (e) {
        addLog("Cannot reach /api/cameras", "WARN");
        setGraphReady(true);
      }
    }

    preloadGraph();
  }, [addLog, buildCameraNodes]);

  // ── PHASE 2: Run tracking pipeline after graph is ready ──────
  useEffect(() => {
    if (!graphReady) return;

    async function runTrackingPipeline() {
      addLog("Tracking pipeline activated", "SYS");

      // Step A: Load alert complaint
      let complaint: any = null;
      try {
        const compRes = await fetch(`/api/complaints?id=${id}`);
        if (compRes.ok) {
          const d = await compRes.json();
          complaint = d.complaint;
          addLog(`Alert: "${complaint?.childName || "Unknown"}" | Start node: Camera ${complaint?.startCameraId || 1}`, "SYS");
        }
      } catch {
        addLog("Complaint data unavailable — using defaults", "WARN");
      }

      const startCameraId = complaint?.startCameraId || 1;

      // Mark start node as scanning immediately
      setCameras(prev => prev.map(c =>
        c.id === String(startCameraId) ? { ...c, status: "scanning" } : c
      ));
      setActiveNodeId(String(startCameraId));

      // Step B: Face encoding
      setPipelinePhase("encoding");
      setScanStatus("Encoding reference face via InsightFace...");
      addLog("Encoding reference image...", "INFO");
      await new Promise(r => setTimeout(r, 600)); // brief visual pause

      // Step C: Tracking
      setPipelinePhase("tracking");
      setScanStatus(`DFS graph traversal — Camera ${startCameraId} → connected nodes...`);
      addLog(`DFS traversal starting from node ${startCameraId}`, "INFO");

      try {
        const trackRes = await fetch("/api/orchestrator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startCameraId,
            timeStr:     complaint?.timeStr     || new Date().toISOString(),
            imageBase64: complaint?.imageBase64 || null,
          }),
        });

        const data = await trackRes.json();

        if (data.success) {
          // Merge graph (in case orchestrator returns enriched data)
          if (data.camera_graph && Object.keys(data.camera_graph).length > 0) {
            setCameraGraph(data.camera_graph);
          }
          setCamerasScanCount(data.cameras_scanned || 0);

          const path: TrackingHit[] = data.tracking_path || [];
          const seq: number[]       = data.path_sequence  || [];
          const matchedIds          = new Set(path.map((h: TrackingHit) => h.camera_id));

          if (path.length > 0) {
            setScanStatus(`Tracking complete — ${path.length} detection(s)`);
            addLog(`Pipeline done: ${path.length} matched / ${data.cameras_scanned} scanned`, "SYS");

            // Animated node state transitions
            path.forEach((hit, idx) => {
              const scanDelay  = idx * 1800;
              const matchDelay = scanDelay + 900;

              const t1 = setTimeout(() => {
                setActiveNodeId(hit.camera_id);
                setCameras(prev => prev.map(c =>
                  c.id === hit.camera_id ? { ...c, status: "scanning" } : c
                ));
                addLog(`Scanning Camera ${hit.camera_id}: ${hit.label}`, "INFO");
              }, scanDelay);

              const t2 = setTimeout(() => {
                setCameras(prev => prev.map(c =>
                  c.id === hit.camera_id
                    ? { ...c, status: "matched", confidence: hit.confidence, timestamp: formatTs(hit.timestamp) }
                    : c
                ));
                addLog(
                  `✓ MATCH — Camera ${hit.camera_id} | ${hit.label} | ${(hit.confidence * 100).toFixed(1)}%${hit.demo_mode ? " [DEMO]" : ""}`,
                  "MATCH"
                );
                setSelectedHit(hit);
              }, matchDelay);

              animationTimers.current.push(t1, t2);
            });

            // After all animations: mark non-matched cameras as clear
            const finalDelay = path.length * 1800 + 900;
            const t3 = setTimeout(() => {
              setCameras(prev => prev.map(c =>
                matchedIds.has(c.id) ? c : { ...c, status: "clear" }
              ));
              setTrackingPath(path);
              setPathSequence(seq);
              setActiveNodeId(null);
              setPipelinePhase("done");
            }, finalDelay);
            animationTimers.current.push(t3);

          } else {
            setScanStatus("No detections — target not found in camera network");
            addLog("No target signature detected in graph traversal", "WARN");
            setCameras(prev => prev.map(c => ({ ...c, status: "clear" })));
            setTrackingPath([]);
            setPathSequence([]);
            setPipelinePhase("done");
          }

        } else {
          setScanStatus(`Orchestrator error: ${data.message}`);
          addLog(`Error: ${data.message}`, "WARN");
          setPipelinePhase("done");
        }

      } catch (err: any) {
        setScanStatus("AI service unreachable — check ai-service container");
        addLog(`Connection failed: ${err.message}`, "WARN");
        setPipelinePhase("done");
      }

      setIsScanning(false);
    }

    runTrackingPipeline();

    // Cleanup animation timers on unmount
    return () => {
      animationTimers.current.forEach(clearTimeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphReady, id]);

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  const pipelineColors = {
    init:     "text-slate-400",
    encoding: "text-yellow-400",
    tracking: "text-blue-400",
    done:     trackingPath.length > 0 ? "text-emerald-400" : "text-slate-400",
  };

  return (
    <div className="h-screen flex flex-col bg-[#020617] text-slate-200 overflow-hidden relative selection:bg-blue-500/30">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.07] mix-blend-overlay pointer-events-none z-0" />

      {/* ── Header ── */}
      <header className="relative bg-slate-950/80 backdrop-blur-2xl border-b border-white/5 px-4 py-2.5 flex justify-between items-center z-20">
        <div className="flex items-center gap-4">
          <div className="relative w-3 h-3">
            <div className="absolute inset-0 bg-rose-500 rounded-full animate-ping opacity-70" />
            <div className="relative w-3 h-3 bg-red-600 rounded-full" />
          </div>
          <h1 className="font-extrabold font-mono tracking-tighter text-white flex items-center gap-2 text-base">
            <span className="bg-gradient-to-r from-red-500 to-rose-400 bg-clip-text text-transparent">AMBER</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400 text-sm font-normal bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md">{id}</span>
          </h1>
          {/* Pipeline phase indicator */}
          <div className={`hidden md:flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-wider ${pipelineColors[pipelinePhase]}`}>
            {pipelinePhase === "tracking" && <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />}
            {pipelinePhase === "encoding" && <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />}
            {pipelinePhase === "done" && trackingPath.length > 0 && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
            {pipelinePhase}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Match/no-match badge */}
          <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-mono font-bold ${
            isScanning
              ? "bg-yellow-950/40 border-yellow-700/50 text-yellow-400"
              : trackingPath.length > 0
              ? "bg-emerald-950/40 border-emerald-700/50 text-emerald-400"
              : "bg-slate-900 border-slate-700 text-slate-500"
          }`}>
            {isScanning
              ? <><Loader2 size={10} className="animate-spin" /> SCANNING</>
              : trackingPath.length > 0
              ? <><CheckCircle2 size={10} /> {trackingPath.length} MATCH{trackingPath.length > 1 ? "ES" : ""}</>
              : <><XCircle size={10} /> NO MATCH</>
            }
          </div>

          {/* Mode toggle */}
          <div className="flex items-center bg-slate-900/60 p-1 rounded-xl border border-slate-800">
            {(["person", "vehicle"] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1 text-xs font-bold transition-all ${
                  mode === m ? "bg-gradient-to-b from-blue-500 to-blue-600 text-white" : "text-slate-500 hover:text-white"
                }`}
              >
                {m === "person" ? <User size={11} /> : <Car size={11} />}
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Main layout ── */}
      <div className="flex-1 flex overflow-hidden relative z-10 p-2 gap-2 min-h-0">

        {/* ── Left: System Log ── */}
        <div className="w-64 flex flex-col bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl shrink-0">
          <div className="p-2.5 border-b border-slate-800/50 flex items-center justify-between bg-slate-950/40">
            <span className="text-xs font-mono font-semibold text-white flex items-center gap-1.5">
              <Activity className="text-blue-500" size={12} /> SYSTEM LOG
            </span>
            {isScanning && <Loader2 className="animate-spin text-blue-400" size={11} />}
          </div>

          <div className="px-3 py-2 border-b border-slate-800/30 bg-slate-950/20">
            <p className="font-mono text-[10px] text-slate-500 leading-snug">{scanStatus}</p>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-3 text-center px-2 py-2 border-b border-slate-800/30 gap-1">
            {[
              { label: "NODES", val: Object.keys(cameraGraph).length || "—", color: "blue"    },
              { label: "SCAN",  val: camerasScanCount || "—",              color: "yellow"  },
              { label: "FOUND", val: trackingPath.length || (isScanning ? "—" : "0"), color: "emerald" },
            ].map(s => (
              <div key={s.label} className={`bg-slate-900/60 rounded-lg py-1.5`}>
                <p className="text-[8px] font-mono text-slate-600 uppercase">{s.label}</p>
                <p className={`text-base font-bold text-${s.color}-400`}>{s.val}</p>
              </div>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            <AnimatePresence>
              {systemLog.map((entry, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25 }}
                  className={`p-2 rounded-lg border text-[10px] font-mono relative overflow-hidden ${
                    entry.type === "MATCH" ? "bg-red-950/30 border-red-600/30"
                    : entry.type === "WARN" ? "bg-yellow-950/20 border-yellow-800/30"
                    : entry.type === "SYS"  ? "bg-blue-950/20 border-blue-800/30"
                    : "bg-slate-900/40 border-slate-800/40"
                  }`}
                >
                  <div className={`absolute left-0 inset-y-0 w-0.5 ${
                    entry.type === "MATCH" ? "bg-red-500"
                    : entry.type === "WARN" ? "bg-yellow-500"
                    : entry.type === "SYS"  ? "bg-blue-500"
                    : "bg-slate-700"
                  }`} />
                  <div className="pl-2">
                    <span className="text-[8px] text-slate-600">{entry.time}</span>
                    <p className={`mt-0.5 leading-snug ${
                      entry.type === "MATCH" ? "text-red-300"
                      : entry.type === "WARN" ? "text-yellow-400"
                      : "text-slate-300"
                    }`}>{entry.msg}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Center: Camera Graph ── */}
        <div className="flex-1 relative bg-slate-900/30 border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl min-w-0">
          {!graphReady ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/50">
              <Loader2 className="animate-spin text-blue-500" size={36} />
              <p className="font-mono text-xs text-slate-500">Loading camera network...</p>
            </div>
          ) : (
            <CameraGraphView
              cameras={cameras}
              graph={cameraGraph}
              pathSequence={pathSequence}
              activeNodeId={activeNodeId}
            />
          )}
        </div>

        {/* ── Right: Detection Timeline ── */}
        <div className="w-72 flex flex-col bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl shrink-0">
          <div className="p-2.5 border-b border-slate-800/50 flex justify-between items-center bg-slate-950/40">
            <span className="font-semibold text-xs text-white font-mono flex items-center gap-1.5">
              <Route size={12} className="text-purple-400" /> DETECTION PATH
            </span>
            <span className="font-mono text-[9px] text-slate-500 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
              {trackingPath.length} HITS
            </span>
          </div>

          {/* Path sequence breadcrumb */}
          {pathSequence.length > 0 && (
            <div className="px-3 py-2 border-b border-slate-800/30 bg-slate-950/30">
              <div className="flex items-center gap-1 flex-wrap">
                <Network size={9} className="text-emerald-500 shrink-0" />
                {pathSequence.map((nodeId, idx) => (
                  <span key={idx} className="flex items-center gap-0.5">
                    <span className="text-[10px] font-mono font-bold text-emerald-400">{nodeId}</span>
                    {idx < pathSequence.length - 1 && <ChevronRight size={8} className="text-slate-700" />}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Confidence formula */}
          <div className="px-3 py-1.5 border-b border-slate-800/30 bg-slate-950/20 font-mono text-[9px] text-slate-600">
            conf = 0.5·face + 0.3·reid + 0.2·temporal
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">

            {/* Idle state */}
            {isScanning && trackingPath.length === 0 && (
              <div className="flex flex-col items-center justify-center h-32 gap-2 text-slate-600">
                <Loader2 size={24} className="animate-spin" />
                <p className="text-[11px] font-mono text-center">DFS traversal in progress...</p>
              </div>
            )}

            {/* No results */}
            {!isScanning && trackingPath.length === 0 && (
              <div className="flex flex-col items-center justify-center h-32 gap-2 text-slate-600">
                <AlertTriangle size={24} className="opacity-50" />
                <p className="text-[11px] font-mono text-center">No detections in camera network</p>
              </div>
            )}

            <AnimatePresence>
              {trackingPath.map((hit, idx) => (
                <motion.div
                  key={hit.camera_id + idx}
                  initial={{ opacity: 0, y: 14, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: idx * 0.1, duration: 0.35 }}
                  onClick={() => setSelectedHit(prev => prev?.camera_id === hit.camera_id ? null : hit)}
                  className={`rounded-xl border cursor-pointer transition-all relative overflow-hidden ${
                    selectedHit?.camera_id === hit.camera_id
                      ? "bg-red-950/40 border-red-500/50 shadow-[0_0_18px_rgba(239,68,68,0.15)]"
                      : "bg-slate-900/60 border-slate-700/50 hover:border-slate-600"
                  }`}
                >
                  {/* Left accent bar */}
                  <div className="absolute left-0 inset-y-0 w-1 bg-rose-500" />

                  <div className="p-2.5 pl-3">
                    {/* Header row */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[9px] font-mono text-rose-400 font-bold tracking-widest">
                        CAM {hit.camera_id}{hit.demo_mode ? " · DEMO" : ""}
                      </span>
                      <span className="text-[9px] font-mono text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                        {(hit.confidence * 100).toFixed(1)}%
                      </span>
                    </div>

                    <p className="text-sm font-bold text-white leading-tight">{hit.label}</p>

                    {/* Timestamp */}
                    <div className="flex items-center gap-1 mt-1.5">
                      <Clock size={9} className="text-slate-600" />
                      <span className="text-[9px] font-mono text-slate-400">{formatTs(hit.timestamp)}</span>
                    </div>

                    {/* Confidence components */}
                    <div className="mt-2 grid grid-cols-3 gap-1">
                      {[
                        { label: "FACE", weight: "50%" },
                        { label: "REID", weight: "30%" },
                        { label: "TEMP", weight: "20%" },
                      ].map(c => (
                        <div key={c.label} className="flex flex-col items-center bg-slate-950/50 px-1 py-1 rounded text-[8px] font-mono text-slate-600">
                          <span>{c.label}</span>
                          <span className="text-slate-500 font-bold">{c.weight}</span>
                        </div>
                      ))}
                    </div>

                    {/* Frame preview (expanded) */}
                    {selectedHit?.camera_id === hit.camera_id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="mt-2"
                      >
                        {hit.frame_b64 ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`data:image/jpeg;base64,${hit.frame_b64}`}
                              alt="Detection frame"
                              className="w-full rounded-lg border border-slate-700 object-cover"
                            />
                            <p className="text-[8px] font-mono text-slate-600 text-center mt-1">AI Detection Frame</p>
                          </>
                        ) : (
                          <div className="w-full h-20 rounded-lg border border-slate-700 bg-slate-950/60 flex flex-col items-center justify-center gap-1 text-slate-700">
                            <MonitorPlay size={18} />
                            <p className="text-[9px] font-mono">Frame preview (demo mode)</p>
                          </div>
                        )}
                      </motion.div>
                    )}

                    {/* Path continuation arrow */}
                    {idx < trackingPath.length - 1 && (
                      <div className="mt-2 flex items-center gap-1 text-[9px] font-mono text-slate-700">
                        <ChevronRight size={10} />
                        <span>Camera {trackingPath[idx + 1].camera_id}</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Footer actions */}
          <div className="p-2.5 border-t border-slate-800/50 space-y-2">
            <button className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 py-2.5 rounded-xl transition-all text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2">
              <Route size={11} /> Export Tracking Report
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
