import Link from "next/link";

const SCHOLARSHIPS = [
  {
    flag: "🇮🇩",
    name: "LPDP RI",
    region: "Indonesia",
    desc: "Beasiswa unggulan pemerintah Indonesia untuk studi S2/S3 di dalam dan luar negeri. Fokus pada kontribusi nasional dan rencana kembali.",
    focus: ["Kontribusi Nasional", "Rencana Studi", "Kepemimpinan"],
  },
  {
    flag: "🇺🇸",
    name: "Fulbright",
    region: "Amerika Serikat",
    desc: "Program pertukaran pendidikan internasional AS untuk studi S2. Menekankan pemahaman lintas budaya dan dampak komunitas.",
    focus: ["Cross-cultural Understanding", "Community Impact", "Akademik"],
  },
  {
    flag: "🇬🇧",
    name: "Chevening",
    region: "Britania Raya",
    desc: "Beasiswa pemerintah Inggris untuk calon pemimpin masa depan. Sangat kompetitif dengan penekanan pada leadership dan networking.",
    focus: ["Leadership", "Networking", "Influence"],
  },
  {
    flag: "🇪🇺",
    name: "Erasmus Mundus",
    region: "Uni Eropa",
    desc: "Program joint master degree di beberapa universitas Eropa. Menekankan pengalaman internasional dan kolaborasi akademik.",
    focus: ["International Experience", "Kolaborasi", "Akademik"],
  },
  {
    flag: "🇩🇪",
    name: "DAAD",
    region: "Jerman",
    desc: "Layanan pertukaran akademik Jerman untuk studi S2/S3 dan riset. Fokus pada keunggulan akademik dan relevansi riset.",
    focus: ["Research Excellence", "Akademik", "Inovasi"],
  },
  {
    flag: "🇦🇺",
    name: "Australia Awards (AAS)",
    region: "Australia",
    desc: "Beasiswa pemerintah Australia untuk negara berkembang. Menekankan pembangunan kapasitas dan dampak di negara asal.",
    focus: ["Development Impact", "Kapasitas", "Keberlanjutan"],
  },
  {
    flag: "🏢",
    name: "Djarum Beasiswa Plus",
    region: "Indonesia",
    desc: "Beasiswa korporat untuk mahasiswa S1 berprestasi di Indonesia. Fokus pada pengembangan soft skill dan leadership.",
    focus: ["Soft Skills", "Leadership", "Prestasi"],
  },
];

export default function ScholarshipsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
      {/* Header */}
      <div className="text-center mb-14 animate-fade-in-up">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
          Supported Scholarships
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          EssayMentor AI memberikan feedback yang disesuaikan dengan kriteria
          evaluasi spesifik dari setiap program beasiswa berikut.
        </p>
      </div>

      {/* Scholarship Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
        {SCHOLARSHIPS.map((s) => (
          <div
            key={s.name}
            className="glass glass-hover rounded-2xl p-6 flex flex-col"
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">{s.flag}</span>
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  {s.name}
                </h3>
                <p className="text-xs text-slate-500">{s.region}</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-5 flex-1">
              {s.desc}
            </p>

            <div className="flex flex-wrap gap-2 mb-5">
              {s.focus.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-primary-500/10 border border-primary-500/20 px-2.5 py-1 text-[11px] font-medium text-primary-700 dark:text-primary-300"
                >
                  {tag}
                </span>
              ))}
            </div>

            <Link
              href="/evaluator"
              className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline transition-colors inline-flex items-center"
            >
              Evaluate for this scholarship
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
