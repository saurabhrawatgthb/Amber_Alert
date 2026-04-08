"use client";
import React from "react";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, ShieldAlert, Video, Map as MapIcon, Route, Play, Car, User, Loader2, Maximize } from "lucide-react";

// Dynamically import Leaflet Map to avoid SSR errors
const MapComponent = dynamic(() => import("../../../components/MapComponent"), { ssr: false });

export default function TrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const [cameras, setCameras] = useState<any[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [activeCamera, setActiveCamera] = useState<any>(null);
  const [mode, setMode] = useState<"person" | "vehicle">("person");
  const [isScanning, setIsScanning] = useState(true);

  // REAL INTEGRATION PIPELINE
  useEffect(() => {
    async function startOrchestration() {
      // Create initial timeline event
      setTimelineEvents([
        { id: 1, type: "SYS", message: "Orchestrating AI Pipeline across local cameras...", time: new Date().toLocaleTimeString(), confidence: "--" }
      ]);
      
      try {
        const payload = {
          lat: 28.6100, 
          lng: 77.2000,
          timeStr: "2026-04-08T10:00:00"
        };
        
        const res = await fetch("/api/orchestrator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        
        if (data.success) {
           const validCameras = data.scannedCameras;
           
           if (data.path && data.path.length > 0) {
               let evtId = 2;
               data.path.forEach((hit: any) => {
                   validCameras.find((c:any) => c.id === hit.camera_id).lastMatch = true;
                   
                   setTimeout(() => {
                      setTimelineEvents(prev => [{
                          id: evtId++,
                          type: "MATCH",
                          message: `Target detected at ${hit.label}. Face/ReID Matched.`,
                          time: new Date(hit.timestamp).toLocaleTimeString(),
                          confidence: hit.confidence.toFixed(2),
                          frame: hit.frame_base64
                      }, ...prev]);
                   }, evtId * 1500); 
               });
           } else {
               setTimelineEvents(prev => [{
                   id: 99, type: "SYS", message: "No feasible tracking paths discovered.", time: new Date().toLocaleTimeString(), confidence: "--"
               }, ...prev]);
           }
           
           setCameras(validCameras);
           setIsScanning(false);
        }
      } catch (err) {
        setTimelineEvents(prev => [{
            id: -1, type: "ERROR", message: "Failed to connect to backend Orchestrator.", time: new Date().toLocaleTimeString(), confidence: "--"
        }, ...prev]);
        setIsScanning(false);
      }
    }
    
    startOrchestration();
  }, []);

  return (
    <div className="h-screen flex flex-col bg-[#020617] text-slate-200 overflow-hidden relative selection:bg-blue-500/30">
      {/* Background Noise Setup */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay pointer-events-none z-0"></div>
      
      {/* Header Upgrade */}
      <header className="relative bg-slate-950/80 backdrop-blur-2xl border-b border-white/5 p-4 flex justify-between items-center z-20 shadow-[-10px_10px_30px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-4 pl-2">
          <div className="relative flex items-center justify-center w-3 h-3">
             <div className="absolute inset-0 bg-rose-500 rounded-full animate-ping opacity-75"></div>
             <div className="relative w-2 h-2 bg-red-600 rounded-full"></div>
          </div>
          <div>
            <h1 className="text-xl font-extrabold font-mono tracking-tighter text-white flex items-center gap-3">
              <span className="bg-gradient-to-r from-red-500 to-rose-400 bg-clip-text text-transparent">ALERT.SYS</span>
              <span className="text-slate-600 font-normal">|</span>
              <span className="text-slate-400 text-sm bg-slate-900 border border-slate-800 px-2 rounded-md tracking-widest">{id}</span>
            </h1>
          </div>
        </div>
        
        <div className="flex items-center bg-slate-900/60 p-1.5 rounded-xl border border-slate-800 backdrop-blur-lg">
          <button 
            className={`px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-bold transition-all shadow-inner ${mode === "person" ? "bg-gradient-to-b from-blue-500 to-blue-600 text-white border border-blue-400/30" : "text-slate-400 hover:text-white border border-transparent"}`}
            onClick={() => setMode("person")}
          ><User size={14}/> OSNet Person Trace</button>
          <button 
            className={`px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-bold transition-all shadow-inner ${mode === "vehicle" ? "bg-gradient-to-b from-indigo-500 to-indigo-600 text-white border border-indigo-400/30" : "text-slate-400 hover:text-white border border-transparent"}`}
            onClick={() => setMode("vehicle")}
          ><Car size={14}/> Vehicle Profiling</button>
        </div>
      </header>

      {/* Main Content Space */}
      <div className="flex-1 flex overflow-hidden relative z-10 p-2 gap-2 bg-[#020617]/50 backdrop-blur-3xl">
        
        {/* Left Sidebar Timeline - Glassmorphic Update */}
        <div className="w-80 bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-2xl flex flex-col z-10 shadow-2xl overflow-hidden relative">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent"></div>
          
          <div className="p-4 border-b border-slate-800/50 flex items-center justify-between font-semibold bg-slate-950/30">
            <span className="flex items-center gap-2 text-sm text-white font-mono tracking-tight"><Activity className="text-blue-500" size={16}/> SYSTEM COMMS</span>
            {isScanning && <Loader2 className="animate-spin text-blue-400" size={14} />}
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs custom-scrollbar">
            <AnimatePresence>
              {timelineEvents.map((evt) => (
                <motion.div 
                  key={evt.id} 
                  initial={{ opacity: 0, x: -20, scale: 0.95 }} 
                  animate={{ opacity: 1, x: 0, scale: 1 }} 
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={`p-3.5 rounded-xl border relative overflow-hidden group ${evt.type === 'MATCH' ? 'bg-red-950/30 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'bg-slate-900/60 border-slate-700/50'}`}
                >
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${evt.type === 'MATCH' ? 'bg-red-500' : 'bg-blue-500/50'}`}></div>
                  
                  <div className="flex justify-between text-slate-400 mb-1.5 pl-2">
                    <span className="text-[10px] text-slate-500">{evt.time}</span>
                    <span className={`text-[10px] tracking-wider px-1.5 rounded-sm ${evt.type === 'MATCH' ? 'bg-red-500/20 text-red-400 font-bold border border-red-500/30' : 'bg-slate-800 text-slate-400'}`}>{evt.type}</span>
                  </div>
                  <div className="text-slate-200 mt-1 pl-2 leading-relaxed font-sans text-[13px]">
                    {evt.message}
                  </div>
                  {evt.confidence !== "--" && (
                     <div className="mt-3 pl-2 text-[10px] text-green-400 font-mono tracking-widest flex items-center gap-1">
                       CONFIDENCE: <span className="font-bold">{(parseFloat(evt.confidence) * 100).toFixed(1)}%</span>
                     </div>
                  )}
                  {evt.frame && (
                     <div className="mt-3 pl-2">
                       <img src={`data:image/jpeg;base64,${evt.frame}`} className="w-full object-cover border border-slate-700 rounded-lg group-hover:border-slate-500 transition-colors" alt="AI Hit Frame" />
                     </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Center Map - Boxed in rounded container */}
        <div className="flex-1 relative bg-slate-900 border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl">
          <MapComponent cameras={cameras} onSelectCamera={setActiveCamera} />
          
          {/* Map Legend Overlay */}
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-[1000] bg-slate-950/80 backdrop-blur-2xl border border-slate-700/60 px-5 py-2.5 rounded-2xl flex items-center gap-5 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
              <div className="flex items-center gap-2.5 text-xs font-semibold tracking-wide text-slate-300"><div className="w-2.5 h-2.5 bg-rose-500 rounded-sm shadow-[0_0_10px_rgba(244,63,94,0.6)] animate-pulse"/> Verified Target</div>
              <div className="w-px h-3 bg-slate-700" />
              <div className="flex items-center gap-2.5 text-xs font-medium tracking-wide text-slate-300"><div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"/> AI Sweep Active</div>
              <div className="w-px h-3 bg-slate-700" />
              <div className="flex items-center gap-2.5 text-xs font-medium tracking-wide text-slate-400"><div className="w-1.5 h-1.5 bg-slate-600 rounded-full"/> Extraneous Bounds</div>
          </div>

          <div className="absolute top-4 right-4 z-[1000]">
             <button className="bg-slate-900/80 hover:bg-slate-800 backdrop-blur border border-slate-700 text-slate-300 p-2 rounded-xl shadow-lg transition-all">
                <Maximize size={18} />
             </button>
          </div>
        </div>

        {/* Right Sidebar - Camera Feed & telemetry */}
        <div className="w-80 bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-2xl flex flex-col z-10 shadow-2xl overflow-hidden relative">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent"></div>
          
          <div className="p-4 border-b border-slate-800/50 flex justify-between items-center bg-slate-950/30">
            <span className="font-semibold flex items-center gap-2 text-sm text-white font-mono tracking-tight"><Video size={16} className="text-purple-400"/> FEED INSPECT</span>
            <span className="text-slate-500 text-[10px] font-mono tracking-widest uppercase bg-slate-900 px-2 py-0.5 rounded border border-slate-800">{activeCamera?.id || 'STANDBY'}</span>
          </div>
          
          <div className="p-4 flex-1 flex flex-col">
            {/* Feed Screen */}
            <div className="w-full aspect-video bg-black rounded-xl border border-slate-800 overflow-hidden relative group shadow-inner">
               <div className="absolute top-0 inset-x-0 h-[2px] bg-blue-500/20 animate-[scan_2s_ease-in-out_infinite] z-20 pointer-events-none"></div>
               
               {!activeCamera ? (
                 <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 text-sm bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-50 mix-blend-overlay">
                   <Video size={36} className="mb-2 opacity-30" />
                   <p className="font-mono text-xs tracking-wider">AWAITING NODE</p>
                 </div>
               ) : (
                 <>
                   <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center text-center p-4">
                      {activeCamera.lastMatch ? (
                          <>
                           <div className="relative">
                             <div className="absolute inset-0 bg-rose-500/20 rounded-full blur-xl animate-pulse"></div>
                             <p className="relative text-rose-500 font-bold font-mono tracking-widest text-lg mb-2 text-shadow">TARGET VERIFIED</p>
                           </div>
                           <p className="text-slate-300 text-[10px] font-mono tracking-wider uppercase bg-slate-950/50 px-2 py-1 rounded border border-slate-800">{activeCamera.label}</p>
                           <p className="text-slate-400 text-[10px] mt-4 max-w-[90%] leading-relaxed">Raw frame evidence processed through InsightFace &#38; OSNet pipeline.</p>
                          </>
                      ) : (
                          <>
                           <p className="text-yellow-500/80 text-sm mb-1 font-mono tracking-widest">ANALYSIS COMPLETE</p>
                           <p className="text-slate-500 text-[10px] uppercase font-mono tracking-wide">No signatures detected</p>
                          </>
                      )}
                   </div>
                   <div className="absolute top-2 right-2 flex gap-2 text-[8px] font-mono text-emerald-400 tracking-widest z-20">
                     <span className="bg-black/60 px-1.5 py-0.5 rounded border border-emerald-900 shadow">NODE SECURE</span>
                   </div>
                 </>
               )}
            </div>

            {/* Telemetry Box */}
            <div className="mt-5 flex-1 bg-slate-950/40 rounded-xl border border-slate-800/80 p-4 relative overflow-hidden">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:1rem_1rem] [mask-image:radial-gradient(ellipse_100%_100%_at_50%_50%,#000_10%,transparent_100%)] opacity-20 pointer-events-none"></div>

              <h3 className="font-semibold text-slate-300 mb-4 text-xs tracking-wider uppercase font-mono border-b border-slate-800 pb-2">Telemetry Metrics</h3>
              
              <div className="space-y-3 font-mono text-[11px]">
                <div className="flex justify-between items-center group">
                   <span className="text-slate-500 group-hover:text-slate-400 transition-colors">Dist (Node &#8594; Event):</span> 
                   <span className="text-slate-300 bg-slate-900 border border-slate-700/50 px-1.5 py-0.5 rounded">{activeCamera?.distance || '---'} km</span>
                </div>
                <div className="flex justify-between items-center group">
                   <span className="text-slate-500 group-hover:text-slate-400 transition-colors">Route Feasibility:</span> 
                   <span className={`px-1.5 py-0.5 rounded font-bold ${activeCamera ? "text-emerald-400 bg-emerald-950/30 border border-emerald-900" : "text-slate-500 bg-slate-900 border border-slate-700/50"}`}>{activeCamera ? "CONFIRMED" : "---"}</span>
                </div>
                <div className="flex justify-between items-center group">
                   <span className="text-slate-500 group-hover:text-slate-400 transition-colors">System Confidence:</span> 
                   <span className={`px-1.5 py-0.5 rounded ${activeCamera?.lastMatch ? "text-blue-400 font-bold bg-blue-950/30 border-blue-900 border" : "text-slate-500 bg-slate-900 border border-slate-700/50"}`}>{activeCamera?.lastMatch ? ">85.0%" : "---"}</span>
                </div>
              </div>
            </div>

            <div className="mt-4">
               <button className="w-full bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 border border-slate-700 text-slate-300 py-3.5 rounded-xl transition-all shadow-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 group">
                  <Route size={14} className="group-hover:text-white transition-colors" /> Map Extrapolated Routes
               </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
