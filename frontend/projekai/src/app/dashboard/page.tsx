"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function DashboardPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (token) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/essay/history`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setDrafts(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
    }
  }, [token]);

  if (isLoading || !user) return <div className="text-center pt-32 text-slate-400">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 pt-32 pb-16">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Halo, {user.fullName} 👋</h1>
          <p className="text-slate-500">Selamat datang di dashboard Anda.</p>
        </div>
        <Link href="/evaluator" className="btn-gradient px-6 py-2.5 rounded-xl font-semibold text-white">
          + Tulis Esai Baru
        </Link>
      </div>

      <h2 className="text-xl font-semibold text-foreground mb-6">Riwayat Esai</h2>
      
      {loading ? (
        <div className="text-slate-500">Memuat riwayat...</div>
      ) : drafts.length === 0 ? (
        <div className="glass p-10 rounded-2xl text-center">
          <div className="text-4xl mb-4">✍️</div>
          <h3 className="text-lg font-medium text-foreground mb-2">Belum ada esai</h3>
          <p className="text-slate-500 mb-6">Anda belum pernah mengevaluasi esai. Mari mulai sekarang!</p>
          <Link href="/evaluator" className="text-primary-500 font-medium hover:underline">Mulai Menulis &rarr;</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {drafts.map(draft => (
            <div key={draft.id} className="glass glass-hover p-6 rounded-2xl flex flex-col h-full">
              <div className="flex justify-between items-start mb-4">
                <span className="text-xs font-semibold bg-primary-500/10 text-primary-500 px-2 py-1 rounded-md">
                  v{draft.version}
                </span>
                {draft.compositeScore ? (
                  <span className="text-xs font-bold bg-green-500/10 text-green-500 px-2 py-1 rounded-md">
                    Skor: {draft.compositeScore}
                  </span>
                ) : (
                  <span className="text-xs font-bold bg-slate-500/10 text-slate-500 px-2 py-1 rounded-md">
                    Belum dinilai
                  </span>
                )}
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2 line-clamp-1">{draft.title || "Esai Tanpa Judul"}</h3>
              <p className="text-sm text-slate-500 mb-4">{draft.scholarshipTarget || "Target Umum"}</p>
              <div className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <span className="text-xs text-slate-400">{new Date(draft.updatedAt).toLocaleDateString("id-ID")}</span>
                <Link href={`/evaluator?draftId=${draft.id}`} className="text-sm font-medium text-primary-500 hover:text-primary-400">
                  Lanjutkan &rarr;
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
