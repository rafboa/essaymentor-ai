"use client";

import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal login.");
      
      login(data.access_token, data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center h-full pt-32 pb-16">
      <div className="glass p-8 rounded-2xl w-full max-w-md">
        <h2 className="text-2xl font-bold text-foreground mb-6 text-center">Login EssayMentor</h2>
        {error && <div className="bg-red-500/10 text-red-500 p-3 rounded-lg mb-4 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">Email</label>
            <input 
              type="email" 
              required
              className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">Password</label>
            <input 
              type="password" 
              required
              className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="btn-gradient w-full py-3 rounded-xl font-semibold mt-4 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            {loading ? "Loading..." : "Login"}
          </button>
        </form>
        <p className="text-center text-slate-600 dark:text-slate-400 text-sm mt-6">
          Belum punya akun? <Link href="/register" className="text-primary-600 dark:text-primary-400 font-semibold hover:underline">Daftar sekarang</Link>
        </p>
      </div>
    </div>
  );
}
