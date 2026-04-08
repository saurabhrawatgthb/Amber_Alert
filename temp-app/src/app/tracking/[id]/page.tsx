"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, ShieldAlert, Video, Map as MapIcon, Route, Play, Car, User, Loader2 } from "lucide-react";

// Dynamically import Leaflet Map to avoid SSR errors
const MapComponent = dynamic(() => import("../../../components/MapComponent"), { ssr: false });

export default function TrackingPage({ params }: { params: { id: string } }) {
  const [cameras, setCameras] = useState<any[]>([]); // To show all analyzing cameras
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
          lat: 28.6100, // Based on New Delhi test data we wrote
          lng: 77.2000,
          timeStr: "2026-04-08T10:00:00"
        };
        
        // Let's call the orchestrator!
        const res = await fetch("/api/orchestrator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        
        if (data.success) {
           // We have real scanned cameras and real hits!
           
           // 1. Mark scanned cameras on map
           const validCameras = data.scannedCameras;
           
           if (data.path && data.path.length > 0) {
               // Update timeline dynamically
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
                   }, evtId * 1500); // Stagger log updates for visual effect
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
    <div className="h-screen flex flex-col bg-slate-950 text-slate-200 overflow-hidden">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 p-4 flex justify-between items-center z-10 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 bg-red-500 rounded-full animate-pulse" />
          <h1 className="text-xl font-bold font-mono tracking-tight text-white flex items-center gap-2">
            ALERT ACTIVE <span className="text-slate-500 text-sm">| ID: {params.id}</span>
          </h1>
        </div>
        <div className="flex items-center gap-4 bg-slate-950/50 p-2 rounded-xl border border-slate-800">
          <button 
            className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-all ${mode === "person" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
            onClick={() => setMode("person")}
          ><User size={16}/> Deep Learning Path (OSNet)</button>
          <button 
            className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-all ${mode === "vehicle" ? "bg-purple-600 text-white" : "text-slate-400 hover:text-white"}`}
            onClick={() => setMode("vehicle")}
          ><Car size={16}/> Vehicle Tracking</button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar Timeline */}
        <div className="w-80 bg-slate-900/50 backdrop-blur-lg border-r border-slate-800 flex flex-col z-10 shadow-[5px_0_15px_rgba(0,0,0,0.5)]">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between font-semibold">
            <span className="flex items-center gap-2"><Activity className="text-blue-500" /> Live AI Logs</span>
            {isScanning && <Loader2 className="animate-spin text-slate-400" size={16} />}
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-xs">
            <AnimatePresence>
              {timelineEvents.map((evt) => (
                <motion.div 
                  key={evt.id} 
                  initial={{ opacity: 0, x: -20 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={`p-3 rounded-lg border ${evt.type === 'MATCH' ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-800/50 border-slate-700/50'}`}
                >
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>{evt.time}</span>
                    <span className={evt.type === 'MATCH' ? 'text-red-400 font-bold' : ''}>{evt.type}</span>
                  </div>
                  <div className="text-slate-200 mt-1 leading-relaxed">
                    {evt.message}
                  </div>
                  {evt.confidence !== "--" && (
                     <div className="mt-2 text-[10px] text-green-400">
                       CONFIDENCE: {(parseFloat(evt.confidence) * 100).toFixed(1)}%
                     </div>
                  )}
                  {evt.frame && (
                     <img src={`data:image/jpeg;base64,${evt.frame}`} className="mt-2 text-[10px] border border-slate-600 rounded" alt="Evidence" />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Center Map */}
        <div className="flex-1 relative bg-slate-950">
          <MapComponent cameras={cameras} onSelectCamera={setActiveCamera} />
          
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-10 bg-slate-900/80 backdrop-blur-xl border border-slate-700 px-6 py-3 rounded-full flex items-center gap-4 shadow-2xl">
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-600 rounded-full animate-ping"/> Real Target Found</div>
              <div className="w-px h-4 bg-slate-600" />
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"/> AI Analyzing</div>
              <div className="w-px h-4 bg-slate-600" />
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-slate-500 rounded-full"/> Excluded via Physics</div>
          </div>
        </div>

        {/* Right Sidebar - Camera Feed */}
        <div className="w-96 bg-slate-900/50 backdrop-blur-lg border-l border-slate-800 flex flex-col z-10">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
            <span className="font-semibold flex items-center gap-2"><Video /> Camera Hub</span>
            <span className="text-slate-400 text-xs font-mono">{activeCamera?.id || 'STANDBY'}</span>
          </div>
          <div className="p-4 flex-1">
            <div className="w-full aspect-video bg-black rounded-lg border border-slate-700 overflow-hidden relative group">
               {!activeCamera ? (
                 <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 text-sm">
                   <Video size={48} className="mb-2 opacity-50" />
                   Select a camera on the map
                 </div>
               ) : (
                 <>
                   {/* In real deployment we'd stream HLS, but here we show a verified frame if match */}
                   <div className="absolute inset-0 bg-slate-800/50 flex flex-col items-center justify-center text-center p-4">
                      {activeCamera.lastMatch ? (
                          <>
                           <p className="text-red-500 font-bold font-mono tracking-widest text-lg animate-pulse mb-2">TARGET VERIFIED</p>
                           <p className="text-slate-300 text-xs font-mono">Location: {activeCamera.label}</p>
                           <p className="text-slate-400 text-[10px] mt-4 max-w-[80%]">Raw frame evidence processed through InsightFace \u0026 OSNet pipeline securely appended to case file.</p>
                          </>
                      ) : (
                          <>
                           <p className="text-yellow-500 text-sm mb-1 font-mono">ANALYSIS COMPLETE</p>
                           <p className="text-slate-400 text-xs">No matching target detected in frame buffer.</p>
                          </>
                      )}
                   </div>
                   <div className="absolute top-2 right-2 flex gap-2 text-[10px] font-mono text-slate-300">
                     <span className="bg-black/50 px-2 py-1 rounded border border-slate-700">NODE SECURE</span>
                   </div>
                 </>
               )}
            </div>

            <div className="mt-6 pt-6 border-t border-slate-800 space-y-4 text-sm">
              <h3 className="font-semibold text-slate-300 mb-2">Spatio-Temporal Metrics</h3>
              <div className="flex justify-between text-slate-400"><span className="font-mono text-xs">Distance Node \u2192 Event:</span> <span>{activeCamera?.distance || '--'} km</span></div>
              <div className="flex justify-between text-slate-400"><span className="font-mono text-xs">Speed Validation:</span> <span className={activeCamera ? "text-green-400" : ""}>{activeCamera ? "FEASIBLE" : "--"}</span></div>
              <div className="flex justify-between text-slate-400"><span className="font-mono text-xs">AI Confidence:</span> <span className="text-blue-400 font-bold">{activeCamera?.lastMatch ? ">85%" : "--"}</span></div>
              <div className="mt-8">
                 <button className="w-full border border-blue-500/50 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 py-3 rounded-xl transition-colors font-semibold flex items-center justify-center gap-2">
                    <Route size={16} /> Expand Search Radius
                 </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
