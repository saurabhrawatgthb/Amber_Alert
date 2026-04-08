"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, MapPin, Video, FileImage, ShieldCheck, Camera, Activity, Radio, ChevronRight, Fingerprint } from "lucide-react";

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [childName, setChildName] = useState("");

  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const formData = new FormData();
      formData.append("childName", childName);
      // Hardcode location for hackathon parsing simulation, or send string
      formData.append("location", JSON.stringify({ lat: 28.6100, lng: 77.2000 }));
      if (file) {
        formData.append("image", file);
      }

      const res = await fetch("/api/complaints", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      
      if (data.success && data.id) {
        router.push(`/tracking/${data.id}`);
      } else {
        console.error("Failed to submit", data);
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 relative overflow-x-hidden font-sans pb-20 selection:bg-blue-500/30">
      {/* Abstract Backgrounds */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay pointer-events-none z-0"></div>
      <div className="fixed top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-900/20 via-transparent to-transparent pointer-events-none"></div>
      
      {/* Grid Floor */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30 pointer-events-none z-0"></div>

      {/* Floating Tactical HUD Elements */}
      <div className="fixed top-24 left-8 text-[10px] text-blue-500/50 font-mono hidden xl:block pointer-events-none">
        <p>SYS.NODE: ONLINE</p>
        <p>NET.UPLINK: SECURE</p>
        <p>GEO.TRK: ACTIVE</p>
      </div>

      {/* Navbar Upgrade */}
      <nav className="relative z-50 border-b border-white/5 bg-slate-950/50 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 shadow-[0_0_20px_rgba(225,29,72,0.4)]">
              <ShieldCheck className="text-white" size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xl tracking-tight text-white shadow-rose-500/50 mix-blend-difference">AmberAlert<span className="text-rose-500">AI</span></span>
                <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20 tracking-wider">Live</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-xs font-mono text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              ID: 4091-ALPHA
            </div>
            <button onClick={() => router.push("/login")} className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Terminate Session</button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 mt-16 relative z-10 w-full">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mb-10 text-center sm:text-left flex flex-col sm:flex-row justify-between items-end">
          <div>
            <h1 className="text-4xl sm:text-5xl font-extrabold mb-3 tracking-tight bg-gradient-to-br from-white via-slate-200 to-slate-500 bg-clip-text text-transparent">Initiate Protocol</h1>
            <p className="text-slate-400 text-lg sm:max-w-xl">Deploy centralized AI agents across the municipal camera network to track targets through spatiotemporal reasoning.</p>
          </div>
          <div className="hidden sm:flex flex-col items-end gap-1 font-mono text-xs text-slate-500">
             <span className="flex items-center gap-2"><Activity size={14} className="text-blue-500" /> GPU CLUSTER: IDLE</span>
             <span className="flex items-center gap-2"><Camera size={14} className="text-blue-500" /> 14,204 CAMERAS SYNCED</span>
          </div>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">
            
            {/* Main Form Left Side */}
            <div className="space-y-6">
              {/* Target Identification Panel */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1, duration: 0.5 }}
                className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden group"
              >
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                
                <h2 className="text-xl font-bold mb-6 flex items-center gap-3 text-white">
                  <span className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <Fingerprint size={20} />
                  </span>
                  Target Demographics
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Subject Name</label>
                    <input 
                      type="text" 
                      required 
                      value={childName}
                      onChange={e => setChildName(e.target.value)}
                      className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-medium" 
                      placeholder="e.g. Jane Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Last Known Location (LKL)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                        <MapPin size={18} />
                      </div>
                      <input 
                        type="text" 
                        required 
                        className="w-full bg-slate-950/50 border border-slate-800 rounded-xl pl-11 pr-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-medium" 
                        placeholder="Street, Intersection..."
                        defaultValue="Sector 4, Central Station"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Media Upload Panel */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                  className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 shadow-2xl relative group"
                >
                  <h2 className="text-lg font-bold mb-1 flex items-center gap-2 text-white"><FileImage size={18} className="text-indigo-400"/> Primary Identity</h2>
                  <p className="text-slate-400 text-xs mb-4">High clarity photo for InsightFace embedding generation.</p>
                  
                  <div 
                    className="h-40 border hover:border-indigo-500/50 border-dashed border-slate-700/80 bg-slate-950/50 rounded-2xl flex flex-col items-center justify-center text-center transition-all cursor-pointer group-hover:bg-indigo-500/5 relative"
                  >
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                    <div className="p-3 bg-slate-800 rounded-full mb-3 group-hover:scale-110 group-hover:bg-indigo-500/20 transition-all duration-300">
                      <Upload className="text-indigo-400" size={24} />
                    </div>
                    <span className="text-slate-300 text-sm font-medium">
                      {file ? file.name : "Inject Face Data"}
                    </span>
                  </div>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                  className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 shadow-2xl relative group"
                >
                  <h2 className="text-lg font-bold mb-1 flex items-center gap-2 text-white"><Video size={18} className="text-purple-400"/> Gait Baseline (Opt)</h2>
                  <p className="text-slate-400 text-xs mb-4">Sample video for OSNet deep appearance metrics.</p>
                  
                  <div className="h-40 border hover:border-purple-500/50 border-dashed border-slate-700/80 bg-slate-950/50 rounded-2xl flex flex-col items-center justify-center text-center transition-all cursor-pointer group-hover:bg-purple-500/5">
                    <div className="p-3 bg-slate-800 rounded-full mb-3 group-hover:scale-110 group-hover:bg-purple-500/20 transition-all duration-300">
                      <Upload className="text-purple-400" size={24} />
                    </div>
                    <span className="text-slate-300 text-sm font-medium">Inject Video Data</span>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Side Action Panel */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}
              className="bg-gradient-to-b from-slate-900/80 to-slate-950/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-2xl h-full flex flex-col relative overflow-hidden"
            >
               {/* Internal scanning line */}
              <div className="absolute inset-0 bg-gradient-to-b from-blue-500/0 via-blue-500/5 to-blue-500/0 w-full h-[100%] animate-[scan_3s_ease-in-out_infinite]"></div>

              <div className="mb-auto pointer-events-none">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2"><Radio size={16} className="text-rose-500"/> System Status</h3>
                
                <div className="space-y-4 text-xs font-medium">
                  <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl flex justify-between items-center relative overflow-hidden">
                    <span className="text-slate-400 z-10">AI Pipeline</span>
                    <span className="text-emerald-400 z-10 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Ready</span>
                  </div>
                  <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl flex justify-between items-center">
                    <span className="text-slate-400">YOLOv8 Core</span>
                    <span className="text-emerald-400 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Online</span>
                  </div>
                  <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl flex justify-between items-center">
                    <span className="text-slate-400">Camera DB</span>
                    <span className="text-emerald-400 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Synced</span>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                 <button 
                    type="submit" 
                    disabled={loading}
                    className="group relative w-full bg-gradient-to-br from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-sm rounded-xl px-4 py-4 shadow-[0_0_30px_rgba(225,29,72,0.3)] hover:shadow-[0_0_40px_rgba(225,29,72,0.5)] transition-all overflow-hidden"
                 >
                    <div className="absolute inset-0 bg-white/20 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                    <div className="relative flex items-center justify-center gap-2">
                      {loading ? (
                        <>
                          <Activity className="animate-pulse" size={18} />
                          Initializing AI Pipeline...
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={18} />
                          Broadcast Alert
                        </>
                      )}
                    </div>
                 </button>
                 <p className="text-center text-[10px] text-slate-500 mt-3 font-mono">AUTHORIZED USE ONLY (TITLE 18 U.S.C)</p>
              </div>
            </motion.div>

          </div>
        </form>
      </main>


    </div>
  );
}
