// ===========================================================================
// DTO: SubmitEssayDto
// ===========================================================================
// Data Transfer Object yang mendefinisikan shape request body
// saat frontend mengirim esai untuk dievaluasi oleh Gemini.
// Validasi dilakukan secara manual di controller karena MVP ini
// belum menggunakan class-validator (bisa ditambahkan nanti).
// ===========================================================================

export class SubmitEssayDto {
  /** ID user pemilik esai (sementara dikirim dari frontend, nanti dari JWT). */
  userId: string;

  /** Judul esai — opsional, fallback ke "Esai Tanpa Judul". */
  title?: string;

  /** Nama beasiswa target, misal "LPDP RI 2026". */
  scholarshipTarget?: string;

  /** Teks LENGKAP esai asli mahasiswa — tidak boleh kosong. */
  content: string;
}
