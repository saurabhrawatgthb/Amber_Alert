"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Upload, MapPin, Video, FileImage, ShieldCheck } from "lucide-react";

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [childName, setChildName] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // In real app, we'd send FormData. Here we just mock it.
    setTimeout(() => {
      setLoading(false);
      // Route to tracking panel with a dummy ID
      router.push(`/tracking/${Date.now()}`);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 relative overflow-hidden pb-20">
      {/* Navbar */}
      <nav className="bg-slate-900/50 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 text-red-500 font-bold text-xl tracking-tight">
            <ShieldCheck /> AmberAlert<span className="text-white">AI</span>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium">
            <span className="text-slate-400">Officer 4091</span>
            <button onClick={() => router.push("/login")} className="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg transition-colors">Logout</button>
          </div>
        </div>
      </nav>

      {/* Background Orbs */}
      <div className="absolute top-20 left-[10%] w-[50vw] h-[50vw] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[10%] w-[40vw] h-[40vw] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />

      <main className="max-w-4xl mx-auto px-6 mt-12 relative z-10">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-4xl font-bold mb-2">Lodge a New Alert</h1>
          <p className="text-slate-400 mb-8">Deploy distributed AI agents across city camera networks.</p>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-xl"
          >
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2"><MapPin className="text-blue-500"/> Core Details</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Child's Full Name</label>
                <input 
                  type="text" 
                  required 
                  value={childName}
                  onChange={e => setChildName(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  placeholder="e.g. John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Last Seen Location</label>
                <input 
                  type="text" 
                  required 
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  placeholder="Street name, City..."
                  defaultValue="Central Station, 5th Ave"
                />
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-xl flex flex-col md:flex-row gap-6"
          >
            <div className="flex-1">
              <h2 className="text-xl font-semibold mb-2 flex items-center gap-2"><FileImage className="text-indigo-500"/> Target Identity</h2>
              <p className="text-slate-400 text-sm mb-4">Upload a clear photo for the AI facial recognition model.</p>
              <div className="border-2 border-dashed border-slate-700 rounded-2xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-800/50 transition-colors cursor-pointer cursor-emerald-400">
                <Upload className="text-slate-400 mb-2" size={32} />
                <span className="text-slate-300 font-medium">Click to upload image</span>
                <span className="text-slate-500 text-xs mt-1">JPEG, PNG up to 10MB</span>
              </div>
            </div>

            <div className="flex-1">
              <h2 className="text-xl font-semibold mb-2 flex items-center gap-2"><Video className="text-purple-500"/> Context Video (Optional)</h2>
              <p className="text-slate-400 text-sm mb-4">Upload movement/gait video for DeepSORT tracking.</p>
              <div className="border-2 border-dashed border-slate-700 rounded-2xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-800/50 transition-colors cursor-pointer">
                <Upload className="text-slate-400 mb-2" size={32} />
                <span className="text-slate-300 font-medium">Click to upload video</span>
                <span className="text-slate-500 text-xs mt-1">MP4, MOV up to 50MB</span>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="pt-4 flex justify-end">
             <button 
                type="submit" 
                disabled={loading}
                className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-lg rounded-xl px-8 py-4 shadow-[0_0_30px_rgba(225,29,72,0.3)] transition-all flex items-center gap-3 w-full md:w-auto justify-center"
             >
                {loading ? <Upload className="animate-spin" /> : <ShieldCheck />}
                {loading ? "Deploying Agents..." : "Broadcast Alert & Initialize AI"}
             </button>
          </motion.div>
        </form>
      </main>
    </div>
  );
}
