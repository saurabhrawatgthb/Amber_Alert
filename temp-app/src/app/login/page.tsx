"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Mock login simulating API delay
    setTimeout(() => {
      setLoading(false);
      router.push("/dashboard");
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center relative overflow-hidden text-slate-200">
      {/* Background Shapes */}
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-blue-600/20 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-red-600/20 rounded-full blur-[100px]" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="z-10 bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 p-8 rounded-3xl w-full max-w-md shadow-2xl"
      >
        <div className="flex justify-center mb-6">
          <div className="bg-red-500/20 p-4 rounded-full text-red-500 border border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
            <ShieldAlert size={40} />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-center mb-2 tracking-tight">Amber Alert System</h1>
        <p className="text-slate-400 text-center mb-8 text-sm">Secure Police Access Only</p>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Badge Number / Username</label>
            <input type="text" required defaultValue="police" className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Secure Password</label>
            <input type="password" required defaultValue="admin123" className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
          </div>
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button disabled={loading} type="submit" className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl px-4 py-3 mt-4 transition-all flex justify-center items-center gap-2 shadow-lg hover:shadow-blue-500/25">
            {loading ? <Lock size={20} className="animate-spin" /> : "Authenticate"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
