import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
      {/* Header */}
      <div className="text-center mb-14 animate-fade-in-up">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-100 mb-4">
          About EssayMentor <span className="gradient-text">AI</span>
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto">
          Platform evaluasi esai beasiswa berbasis AI yang membantu mahasiswa
          Indonesia meraih impian studi mereka.
        </p>
      </div>

      <div className="space-y-8 stagger-children">
        {/* Mission */}
        <div className="glass rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/10 text-xl">
              🎯
            </span>
            <h2 className="text-xl font-bold text-slate-100">Misi Kami</h2>
          </div>
          <p className="text-slate-400 leading-relaxed">
            Kami percaya bahwa setiap mahasiswa berhak mendapat feedback berkualitas
            untuk esai beasiswa mereka — tanpa biaya mahal dan tanpa kehilangan suara
            autentik mereka. EssayMentor AI hadir untuk mendemokratisasi akses ke
            bimbingan esai beasiswa yang sebelumnya hanya tersedia bagi segelintir orang.
          </p>
        </div>

        {/* How AI Works */}
        <div className="glass rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/10 text-xl">
              🧠
            </span>
            <h2 className="text-xl font-bold text-slate-100">Bagaimana AI Kami Bekerja</h2>
          </div>
          <p className="text-slate-400 leading-relaxed mb-4">
            EssayMentor AI menggunakan Large Language Model (LLM) yang dikonfigurasi
            dengan system prompt khusus yang dirancang oleh para ahli evaluasi beasiswa.
            Model ini diinstruksikan untuk:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: "📊", text: "Menilai 5 dimensi: Struktur, Nada, Relevansi, Orisinalitas, dan Dampak" },
              { icon: "🛡️", text: "Menjaga personal voice — TIDAK menulis ulang kalimat Anda" },
              { icon: "📝", text: "Memberikan saran sebagai instruksi, bukan contoh kalimat jadi" },
              { icon: "🎓", text: "Menyesuaikan evaluasi dengan kriteria beasiswa target" },
            ].map((item) => (
              <div
                key={item.text}
                className="flex items-start gap-3 rounded-xl bg-white/[0.02] border border-border p-4"
              >
                <span className="text-lg shrink-0">{item.icon}</span>
                <p className="text-sm text-slate-300">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tech Stack */}
        <div className="glass rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/10 text-xl">
              ⚙️
            </span>
            <h2 className="text-xl font-bold text-slate-100">Technology Stack</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Frontend", tech: "Next.js", icon: "▲" },
              { label: "Backend", tech: "NestJS", icon: "🔺" },
              { label: "Database", tech: "MySQL + Prisma", icon: "🗄️" },
              { label: "AI Engine", tech: "LLM API", icon: "🤖" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl bg-white/[0.02] border border-border p-4 text-center"
              >
                <span className="text-2xl mb-2 block">{item.icon}</span>
                <p className="text-xs text-slate-500 mb-1">{item.label}</p>
                <p className="text-sm font-semibold text-slate-200">{item.tech}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Team */}
        <div className="glass rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/10 text-xl">
              👥
            </span>
            <h2 className="text-xl font-bold text-slate-100">Tim</h2>
          </div>
          <p className="text-slate-400 leading-relaxed">
            EssayMentor AI dikembangkan sebagai proyek inovasi teknologi pendidikan
            oleh mahasiswa Indonesia yang memahami perjuangan mendapatkan beasiswa.
            Kami menggabungkan keahlian di bidang AI, pengembangan web, dan
            pengalaman langsung dalam proses aplikasi beasiswa.
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="text-center mt-14 animate-fade-in-up">
        <Link
          href="/evaluator"
          className="btn-gradient rounded-xl px-8 py-3.5 text-base font-semibold inline-flex"
        >
          Try EssayMentor AI now
        </Link>
      </div>
    </div>
  );
}
