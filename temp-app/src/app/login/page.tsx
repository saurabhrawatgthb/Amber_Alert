"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, ShieldAlert, ChevronRight, Fingerprint } from "lucide-react";
import { motion } from "framer-motion";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Successful login
        router.push("/dashboard");
      } else {
        // Display error from API
        setError(data.message || "Invalid credentials provided.");
        setLoading(false);
      }
    } catch (err) {
      setError("Failed to connect to authentication server.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] flex items-center justify-center relative overflow-hidden text-slate-200">
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>
      
      {/* Animated Orbs */}
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-blue-600/30 rounded-full blur-[120px]" 
      />
      <motion.div 
        animate={{ 
          scale: [1, 1.3, 1],
          opacity: [0.2, 0.4, 0.2],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-rose-600/20 rounded-full blur-[120px]" 
      />

      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-20"></div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="z-10 bg-slate-900/60 backdrop-blur-2xl border border-slate-700/50 p-10 rounded-[2rem] w-full max-w-md shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden"
      >
        {/* Subtle Shine */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>
        
        <div className="flex justify-center mb-8 relative">
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
            className="bg-gradient-to-b from-rose-500/20 to-rose-500/5 p-4 rounded-2xl text-rose-500 border border-rose-500/30 shadow-[0_0_30px_rgba(244,63,94,0.2)] relative group"
          >
            <div className="absolute inset-0 bg-rose-500/20 rounded-2xl blur-xl group-hover:bg-rose-500/30 transition-all duration-500"></div>
            <ShieldAlert size={40} className="relative z-10" />
          </motion.div>
        </div>

        <motion.div
           initial={{ opacity: 0, y: 10 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.3 }}
        >
          <h1 className="text-3xl font-extrabold text-center mb-2 tracking-tight bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent">Amber Alert AI</h1>
          <p className="text-slate-400 text-center mb-8 text-sm font-medium tracking-wide uppercase letter-spacing-widest">Authorized Access Only</p>
        </motion.div>
        
        <form onSubmit={handleLogin} className="space-y-5">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Badge Number ID</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-blue-400 transition-colors">
                <Fingerprint size={18} />
              </div>
              <input 
                type="text" 
                name="username"
                required 
                defaultValue="police" 
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl pl-11 pr-4 py-3.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-mono text-sm placeholder:text-slate-600 shadow-inner" 
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Security Clearance Code</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-blue-400 transition-colors">
                <Lock size={18} />
              </div>
              <input 
                type="password" 
                name="password"
                required 
                defaultValue="admin123" 
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl pl-11 pr-4 py-3.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-sm placeholder:text-slate-600 shadow-inner" 
              />
            </div>
          </motion.div>

          {error && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-rose-400 text-sm text-center font-medium bg-rose-500/10 py-2 rounded-lg border border-rose-500/20">
              {error}
            </motion.p>
          )}

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="pt-2"
          >
            <button 
              disabled={loading} 
              type="submit" 
              className="group relative w-full bg-white hover:bg-slate-100 text-slate-900 font-bold rounded-xl px-4 py-4 transition-all flex justify-center items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden"
            >
              {/* Button Shine Effect */}
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent group-hover:animate-shimmer"></div>
              
              {loading ? (
                <Lock size={20} className="animate-spin text-blue-600" />
              ) : (
                <>
                  <span>Initialize Secure Session</span>
                  <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </motion.div>
        </form>
      </motion.div>
    </div>
  );
}
