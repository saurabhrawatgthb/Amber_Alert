"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, ShieldCheck, Camera, Activity, ChevronRight,
  Fingerprint, AlertCircle, CheckCircle2, Clock, Network, FileImage, Video, Radio
} from "lucide-react";

// 15-camera options matching camera_metadata.json + camera_graph.json
const CAMERAS = Array.from({ length: 15 }, (_, i) => ({
  id: i + 1,
  label: `Camera ${i + 1}`,
}));

// Adjacency list for the quick-visualiser in the sidebar
const GRAPH: Record<number, number[]> = {
  1: [2, 3], 2: [1], 3: [1, 4, 5], 4: [3, 6], 5: [3, 6],
  6: [4, 5, 7], 7: [6, 8, 9], 8: [7], 9: [7, 10, 11], 10: [9],
  11: [9, 12, 13], 12: [11], 13: [11, 14, 15], 14: [13], 15: [13],
};

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [childName, setChildName] = useState("");
  const [startCameraId, setStartCameraId] = useState<number>(1);
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [timeStr, setTimeStr] = useState(() => new Date().toISOString().slice(0, 16));
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    if (selected) {
      const reader = new FileReader();
      reader.onloadend = () => setFilePreview(reader.result as string);
      reader.readAsDataURL(selected);
    } else {
      setFilePreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("childName", childName);
      formData.append("startCameraId", String(startCameraId));
      formData.append("timeStr", new Date(timeStr).toISOString());
      if (file) formData.append("image", file);

      const res  = await fetch("/api/complaints", { method: "POST", body: formData });
      const data = await res.json();

      if (data.success && data.id) {
        router.push(`/tracking/${data.id}`);
      } else {
        setError(data.message || "Failed to submit alert");
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message || "Network error. Please try again.");
      setLoading(false);
    }
  };

  const neighbours = GRAPH[startCameraId] || [];

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 relative overflow-x-hidden font-sans pb-20 selection:bg-blue-500/30">
      {/* Background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-25 pointer-events-none" />
      <div className="fixed top-0 left-0 w-full h-[400px] bg-gradient-to-b from-blue-900/20 via-transparent to-transparent pointer-events-none" />

      {/* Navbar */}
      <nav className="relative z-50 border-b border-white/5 bg-slate-950/60 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-[0_0_20px_rgba(225,29,72,0.4)]">
              <ShieldCheck className="text-white" size={20} />
            </div>
            <div>
              <span className="font-bold text-xl tracking-tight text-white">
                AmberAlert<span className="text-rose-500">AI</span>
              </span>
              <span className="ml-2 px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20 tracking-wider">
                Live
              </span>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-xs font-mono text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              15 CAMERA NODES · DFS GRAPH
            </div>
            <button onClick={() => router.push("/login")} className="text-sm text-slate-400 hover:text-white transition-colors">
              Terminate Session
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 mt-14 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-2 tracking-tight bg-gradient-to-br from-white via-slate-200 to-slate-500 bg-clip-text text-transparent">
            Initiate Search Protocol
          </h1>
          <p className="text-slate-400 text-base max-w-2xl">
            Select the last known camera node. The AI graph engine will perform a depth-first traversal
            across the connected camera network starting from that node.
          </p>
        </motion.div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-500/40 flex items-center gap-3 text-red-400"
            >
              <AlertCircle size={18} />
              <span className="text-sm font-medium">{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit}>
          <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">

            {/* Left column */}
            <div className="space-y-5">

              {/* Subject info */}
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
                className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl"
              >
                <h2 className="text-xl font-bold mb-6 flex items-center gap-3 text-white">
                  <span className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <Fingerprint size={20} />
                  </span>
                  Subject Information
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Subject Name *</label>
                    <input
                      type="text" required value={childName} onChange={e => setChildName(e.target.value)}
                      placeholder="e.g. Jane Doe"
                      className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Last Known Time</label>
                    <div className="relative">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                      <input
                        type="datetime-local" value={timeStr} onChange={e => setTimeStr(e.target.value)}
                        className="w-full bg-slate-950/50 border border-slate-800 rounded-xl pl-11 pr-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-medium text-slate-300"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Camera node selector */}
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }}
                className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl"
              >
                <h2 className="text-xl font-bold mb-2 flex items-center gap-3 text-white">
                  <span className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <Network size={20} />
                  </span>
                  Start Camera Node
                </h2>
                <p className="text-xs text-slate-500 mb-5">Select where the child was last seen. DFS traversal begins here.</p>

                {/* Quick-select grid: 15 cameras in 5 columns */}
                <div className="grid grid-cols-5 gap-2 mb-5">
                  {CAMERAS.map(cam => (
                    <button
                      key={cam.id}
                      type="button"
                      onClick={() => setStartCameraId(cam.id)}
                      className={`py-2.5 rounded-xl text-xs font-bold border transition-all flex flex-col items-center gap-1 ${
                        startCameraId === cam.id
                          ? "bg-blue-500/20 border-blue-500/70 text-blue-300 shadow-[0_0_14px_rgba(59,130,246,0.35)]"
                          : "bg-slate-900/80 border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-300"
                      }`}
                    >
                      <Camera size={10} />
                      {cam.id}
                    </button>
                  ))}
                </div>

                {/* Dropdown fallback */}
                <div className="relative">
                  <Camera className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <select
                    value={startCameraId}
                    onChange={e => setStartCameraId(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-medium text-slate-200 appearance-none"
                  >
                    {CAMERAS.map(cam => (
                      <option key={cam.id} value={cam.id} className="bg-slate-900">
                        Camera {cam.id} — Direct connections: {GRAPH[cam.id]?.join(", ")}
                      </option>
                    ))}
                  </select>
                  <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 rotate-90 pointer-events-none" size={14} />
                </div>

                {/* Selected node info */}
                <div className="mt-3 bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 font-mono text-[11px] text-slate-400 space-y-1">
                  <div className="flex gap-4">
                    <span>NODE: <span className="text-blue-400 font-bold">{startCameraId}</span></span>
                    <span>EDGES → <span className="text-emerald-400">[{neighbours.join(", ")}]</span></span>
                  </div>
                  <div className="text-slate-600">
                    DFS will scan {startCameraId} first, then expand to connected nodes: {neighbours.join(" → ")}
                  </div>
                </div>
              </motion.div>

              {/* Media upload row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                {/* Photo upload */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                  className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-5 shadow-2xl group"
                >
                  <h3 className="text-base font-bold mb-1 flex items-center gap-2 text-white">
                    <FileImage size={16} className="text-indigo-400" /> Reference Photo
                  </h3>
                  <p className="text-slate-500 text-xs mb-3">Clear frontal face image for InsightFace matching.</p>

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="h-36 border border-dashed border-slate-700/80 bg-slate-950/50 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all relative overflow-hidden"
                  >
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                    {filePreview ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={filePreview} alt="Preview" className="absolute inset-0 w-full h-full object-cover opacity-40" />
                        <div className="relative z-10 flex flex-col items-center">
                          <CheckCircle2 className="text-emerald-400 mb-1" size={24} />
                          <span className="text-emerald-300 text-xs font-semibold">Image Loaded</span>
                          <span className="text-slate-500 text-[9px] mt-0.5 max-w-[80%] truncate">{file?.name}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="p-2.5 bg-slate-800 rounded-full mb-2 group-hover:scale-110 group-hover:bg-indigo-500/20 transition-all">
                          <Upload className="text-indigo-400" size={22} />
                        </div>
                        <span className="text-slate-300 text-sm font-medium">Upload Face Photo</span>
                        <span className="text-slate-600 text-[10px] mt-0.5">JPG, PNG — clear frontal</span>
                      </>
                    )}
                  </div>
                </motion.div>

                {/* Video upload (optional) */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                  className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-5 shadow-2xl group"
                >
                  <h3 className="text-base font-bold mb-1 flex items-center gap-2 text-white">
                    <Video size={16} className="text-purple-400" /> Gait Baseline
                    <span className="text-slate-600 text-xs font-normal">(Optional)</span>
                  </h3>
                  <p className="text-slate-500 text-xs mb-3">Walking sample for OSNet ReID features.</p>

                  <div className="h-36 border border-dashed border-slate-700/80 bg-slate-950/50 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-purple-500/50 hover:bg-purple-500/5 transition-all">
                    <div className="p-2.5 bg-slate-800 rounded-full mb-2 group-hover:scale-110 group-hover:bg-purple-500/20 transition-all">
                      <Upload className="text-purple-400" size={22} />
                    </div>
                    <span className="text-slate-300 text-sm font-medium">Upload Video Sample</span>
                    <span className="text-slate-600 text-[10px] mt-0.5">MP4, MOV</span>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Right column — System status + submit */}
            <motion.div
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }}
              className="bg-gradient-to-b from-slate-900/80 to-slate-950/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col"
            >
              <h3 className="font-bold text-white mb-5 flex items-center gap-2">
                <Radio size={15} className="text-rose-500" /> System Status
              </h3>

              <div className="space-y-2.5 text-xs font-medium mb-6">
                {[
                  { label: "YOLOv8 Detection",     status: "Online",  color: "emerald" },
                  { label: "InsightFace ReID",      status: "Standby", color: "blue"    },
                  { label: "OSNet Body ReID",        status: "Standby", color: "blue"    },
                  { label: "MediaPipe Fallback",     status: "Ready",   color: "emerald" },
                  { label: "PaddleOCR (Vehicles)",   status: "Ready",   color: "emerald" },
                  { label: "Graph Engine (DFS)",     status: "Active",  color: "emerald" },
                  { label: "Temporal Validator",     status: "Active",  color: "emerald" },
                ].map(item => (
                  <div key={item.label} className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-xl flex justify-between items-center">
                    <span className="text-slate-400">{item.label}</span>
                    <span className={`text-${item.color}-400 flex items-center gap-1.5`}>
                      <span className={`w-1.5 h-1.5 rounded-full bg-${item.color}-400 animate-pulse`} />
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>

              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 mb-6 font-mono text-[10px] text-slate-500 space-y-0.5 leading-relaxed">
                <p>ALGORITHM: DFS Graph Traversal</p>
                <p>GRAPH: 15 nodes (unweighted)</p>
                <p>CONFIDENCE:</p>
                <p>&nbsp;&nbsp;0.5 × face_match</p>
                <p>&nbsp;&nbsp;0.3 × reid_match</p>
                <p>&nbsp;&nbsp;0.2 × temporal_feasibility</p>
                <p>FRAME SKIP: every 5th frame</p>
                <p className="text-blue-400 mt-1">START NODE: Camera {startCameraId}</p>
                <p className="text-emerald-400">NEXT NODES: [{neighbours.join(", ")}]</p>
              </div>

              <div className="mt-auto">
                <button
                  type="submit"
                  disabled={loading || !childName}
                  className="group relative w-full bg-gradient-to-br from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-500 text-white font-bold text-sm rounded-xl px-4 py-4 shadow-[0_0_30px_rgba(225,29,72,0.3)] hover:shadow-[0_0_40px_rgba(225,29,72,0.5)] transition-all"
                >
                  <div className="flex items-center justify-center gap-2">
                    {loading ? (
                      <><Activity className="animate-pulse" size={18} />Initializing Graph Pipeline...</>
                    ) : (
                      <><ShieldCheck size={18} />Broadcast Alert <ChevronRight size={15} className="ml-1 group-hover:translate-x-1 transition-transform" /></>
                    )}
                  </div>
                </button>
                <p className="text-center text-[10px] text-slate-600 mt-3 font-mono">
                  AUTHORIZED USE ONLY · TITLE 18 U.S.C
                </p>
              </div>
            </motion.div>

          </div>
        </form>
      </main>
    </div>
  );
}
