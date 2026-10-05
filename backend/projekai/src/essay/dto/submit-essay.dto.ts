import { IsNotEmpty, IsString, IsOptional, MinLength, MaxLength, IsIn } from 'class-validator';

export class SubmitEssayDto {
  /** ID user pemilik esai (akan di-override oleh JWT di controller) */
  @IsOptional()
  @IsString()
  userId?: string;

  /** ID draft jika ingin mengupdate esai yang sudah ada (v1 -> v2) */
  @IsOptional()
  @IsString()
  draftId?: string;

  /** Judul esai, opsional, fallback ke "Esai Tanpa Judul". */
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Judul maksimal 200 karakter.' })
  title?: string;

  /** Nama beasiswa target, misal "LPDP RI 2026". */
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Target beasiswa maksimal 100 karakter.' })
  scholarshipTarget?: string;

  /** Teks LENGKAP esai asli mahasiswa. */
  @IsString({ message: 'Konten esai harus berupa teks.' })
  @IsNotEmpty({ message: 'Konten esai tidak boleh kosong.' })
  @MinLength(50, { message: 'Esai terlalu pendek (minimal 50 karakter).' })
  @MaxLength(25000, { message: 'Esai melebihi batas maksimum 25.000 karakter.' })
  content!: string;

  /** Mode evaluasi: 'FULL_ESSAY' atau 'PARAGRAPH'. Default 'FULL_ESSAY' */
  @IsOptional()
  @IsIn(['FULL_ESSAY', 'PARAGRAPH'], { message: 'Mode evaluasi harus FULL_ESSAY atau PARAGRAPH.' })
  mode?: 'FULL_ESSAY' | 'PARAGRAPH';

  /** Jika mode = 'PARAGRAPH', kirim teks paragraf spesifik di sini */
  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: 'Paragraf target maksimal 5.000 karakter.' })
  targetText?: string;
}
