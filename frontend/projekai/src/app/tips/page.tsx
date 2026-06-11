import Link from "next/link";

const TIPS = [
  {
    icon: "🏗️",
    title: "Bangun Struktur Narasi yang Kuat",
    content:
      "Gunakan narrative arc yang jelas: pembuka yang menggugah, pengembangan kronologis atau tematik, dan penutup yang menghubungkan kembali ke tujuan beasiswa. Hindari 'daftar prestasi' — ceritakan perjalanan, bukan resume.",
    tag: "Struktur",
  },
  {
    icon: "🎭",
    title: "Temukan Nada yang Tepat",
    content:
      "Esai beasiswa terbaik menyeimbangkan profesionalisme dan kehangatan personal. Hindari bahasa terlalu formal yang terasa kaku, tapi juga jangan terlalu kasual. Bayangkan Anda berbicara dengan mentor yang Anda hormati.",
    tag: "Nada",
  },
  {
    icon: "✨",
    title: "Jaga Orisinalitas — Hindari Klise",
    content:
      'Kalimat seperti "Sejak kecil saya bermimpi..." atau "Saya ingin berkontribusi untuk bangsa" terlalu umum. Ganti dengan momen spesifik yang hanya Anda yang bisa ceritakan. Detail sensorik membuat esai Anda memorable.',
    tag: "Orisinalitas",
  },
  {
    icon: "🎯",
    title: "Hubungkan Setiap Paragraf ke Beasiswa Target",
    content:
      "Setiap paragraf harus menjawab pertanyaan: 'Mengapa saya kandidat yang tepat untuk beasiswa ini?' Riset nilai-nilai program (leadership, kontribusi, inovasi) dan pastikan esai Anda mencerminkannya.",
    tag: "Relevansi",
  },
  {
    icon: "💥",
    title: "Akhiri dengan Dampak yang Kuat",
    content:
      "Penutup Anda harus meninggalkan kesan yang tak terlupakan. Hubungkan pengalaman personal Anda dengan visi masa depan — apa yang akan Anda lakukan dengan ilmu yang didapat? Buat pembaca merasa berinvestasi pada kesuksesan Anda.",
    tag: "Dampak",
  },
  {
    icon: "🛡️",
    title: "Pertahankan Personal Voice Anda",
    content:
      "Jangan biarkan orang lain menulis ulang esai Anda sampai kehilangan suara asli. Minta feedback berupa instruksi perbaikan, bukan kalimat pengganti. Keunikan gaya tulisan Anda adalah aset, bukan kelemahan.",
    tag: "Personal Voice",
  },
];

export default function TipsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
      {/* Header */}
      <div className="text-center mb-14 animate-fade-in-up">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-100 mb-4">
          Essay Writing Tips
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto">
          Panduan praktis untuk menulis esai beasiswa yang kuat, autentik,
          dan meyakinkan — langsung dari rubrik evaluasi EssayMentor AI.
        </p>
      </div>

      {/* Tips Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 stagger-children">
        {TIPS.map((tip) => (
          <div
            key={tip.title}
            className="glass glass-hover rounded-2xl p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/10 text-xl">
                {tip.icon}
              </span>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-slate-100 truncate">
                  {tip.title}
                </h3>
              </div>
              <span className="rounded-full bg-primary-500/10 border border-primary-500/20 px-2.5 py-0.5 text-[11px] font-medium text-primary-300 shrink-0">
                {tip.tag}
              </span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              {tip.content}
            </p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="text-center mt-16 animate-fade-in-up">
        <div className="glass rounded-2xl p-10 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-purple-500/5 pointer-events-none" />
          <div className="relative">
            <h2 className="text-2xl font-bold text-slate-100 mb-3">
              Siap menerapkan tips ini?
            </h2>
            <p className="text-slate-400 mb-6">
              Tempel esai Anda dan dapatkan evaluasi AI secara instan.
            </p>
            <Link
              href="/evaluator"
              className="btn-gradient rounded-xl px-8 py-3.5 text-sm font-semibold inline-flex"
            >
              Evaluate my essay
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
