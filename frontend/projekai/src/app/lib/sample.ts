import type { Annotation, Scores } from "./api";
import type { Language } from "../i18n/dictionaries";

/**
 * Illustrative sample shown on the home page. Synthetic — written for the
 * demonstration and labelled as a sample wherever it appears.
 */
interface Sample {
  text: string;
  annotations: Annotation[];
  score: number;
  scores: Scores;
}

const scores: Scores = { structure: 85, tone: 80, relevance: 78, originality: 70, impact: 75 };

export const SAMPLE: Record<Language, Sample> = {
  id: {
    text:
      "Ketika saya berusia dua belas tahun, ibu saya mengajak saya ke perpustakaan kota untuk pertama kalinya. Di rak paling bawah saya menemukan buku tentang bendungan dan irigasi. Sejak saat itu saya ingin memahami bagaimana air menghidupi desa kami di Klaten.\n\n" +
      "Setelah lulus teknik sipil, saya bekerja tiga tahun di dinas pekerjaan umum. Saya melihat sendiri bagaimana saluran irigasi tersier rusak karena tidak ada data yang rapi tentang kondisi lapangan. Petani menunggu air yang tidak pernah datang.\n\n" +
      "Saya ingin melanjutkan studi magister manajemen sumber daya air agar bisa membangun sistem pemantauan irigasi berbasis data untuk kabupaten kecil. Setelah kembali, saya berencana bekerja sama dengan pemerintah daerah dan kelompok tani untuk menerapkannya.",
    annotations: [
      { sentenceIndex: 1, type: "SUGGESTION", message: "Tambahkan satu detail: apa yang membuat buku itu menarik bagi Anda?" },
      { sentenceIndex: 2, type: "STRENGTH", message: "Motivasi personal yang jelas dan spesifik." },
      { sentenceIndex: 3, type: "TONE", message: "Nadanya datar dibanding pembuka; tunjukkan apa yang Anda pelajari dari pekerjaan itu." },
      { sentenceIndex: 4, type: "CRITICAL", message: "“Tidak ada data yang rapi” kurang formal; jelaskan masalahnya dengan istilah yang lebih tepat." },
      { sentenceIndex: 5, type: "STRENGTH", message: "Kalimat pendek ini memberi dampak emosional." },
      { sentenceIndex: 6, type: "SUGGESTION", message: "Perjelas “kabupaten kecil” dan skala dampaknya." },
      { sentenceIndex: 7, type: "STRUCTURAL", message: "Tutup dengan target jangka panjang yang bisa diukur." },
    ],
    score: 78,
    scores,
  },
  en: {
    text:
      "When I was twelve, my mother took me to the city library for the first time. On the bottom shelf I found a book about dams and irrigation. From then on I wanted to understand how water keeps our village in Klaten alive.\n\n" +
      "After graduating in civil engineering, I worked for three years at the public works office. I saw for myself how tertiary irrigation channels broke down because there was no tidy data about conditions in the field. Farmers waited for water that never came.\n\n" +
      "I want to pursue a master's in water resources management so I can build a data-driven irrigation monitoring system for small regencies. After returning, I plan to work with local government and farmer groups to put it into practice.",
    annotations: [
      { sentenceIndex: 1, type: "SUGGESTION", message: "Add one detail: what made that book catch your attention?" },
      { sentenceIndex: 2, type: "STRENGTH", message: "A clear, specific personal motivation." },
      { sentenceIndex: 3, type: "TONE", message: "Flat compared with the opening; show what the job taught you." },
      { sentenceIndex: 4, type: "CRITICAL", message: "“No tidy data” is too informal; name the problem more precisely." },
      { sentenceIndex: 5, type: "STRENGTH", message: "This short sentence lands with emotional weight." },
      { sentenceIndex: 6, type: "SUGGESTION", message: "Make “small regencies” concrete, and say how far the impact reaches." },
      { sentenceIndex: 7, type: "STRUCTURAL", message: "Close with a long-term goal that can be measured." },
    ],
    score: 78,
    scores,
  },
};
