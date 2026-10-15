<div align="center">

# 🎓 EssayMentor AI

### *Platform Evaluasi Esai Beasiswa Cerdas Berbasis AI*

<img width="1920" height="1080" alt="brag" src="https://github.com/user-attachments/assets/44293c7a-91fd-43e6-9aba-d72e2f8fab4c" />


https://github.com/user-attachments/assets/93ac7ddd-4973-4d32-913c-7583375568bf



Platform bimbingan dan evaluasi esai beasiswa berbasis kecerdasan buatan (Gemini 3.5 Flash-Lite, dengan cadangan DeepSeek dan Groq) yang dirancang untuk membantu mahasiswa menyusun esai yang persuasif, terstruktur, dan berbobot tanpa menghilangkan keaslian gaya tulisan (personal voice).

[![Frontend](https://img.shields.io/badge/Frontend-Next.js_15_App_Router-000000?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Backend](https://img.shields.io/badge/Backend-NestJS_11-E0234E?style=for-the-badge&logo=nestjs)](https://nestjs.com/)
[![Database](https://img.shields.io/badge/Database-MySQL_8-4479A1?style=for-the-badge&logo=mysql&logoColor=white)](https://www.mysql.com/)
[![ORM](https://img.shields.io/badge/ORM-Prisma_5.22-2D3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![Primary AI](https://img.shields.io/badge/Primary_AI-Gemini_3.5_Flash--Lite-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![Fallback AI](https://img.shields.io/badge/Fallback_AI-DeepSeek_%2B_Groq-F55036?style=for-the-badge&logo=openai&logoColor=white)](https://api-docs.deepseek.com/)

**Frontend Runtime:** Bun &nbsp;·&nbsp; **Backend Runtime:** Node.js (npm) &nbsp;·&nbsp; **Lisensi:** MIT

</div>

---

## 📌 Daftar Isi

1. [Tentang EssayMentor AI](#-tentang-essaymentor-ai)
2. [Fitur Unggulan](#-fitur-unggulan)
3. [Arsitektur & Alur Sistem](#-arsitektur--alur-sistem)
4. [Tech Stack](#-tech-stack)
5. [Struktur Direktori](#-struktur-direktori)
6. [Panduan Memulai (Quick Start)](#-panduan-memulai-quick-start)
7. [Daftar Endpoint API](#-daftar-endpoint-api)
8. [Keamanan & Proteksi API](#-keamanan--proteksi-api)
9. [Kontribusi & Lisensi](#-kontribusi--lisensi)

---

## 💡 Tentang EssayMentor AI

Menulis esai beasiswa bergengsi (seperti LPDP, Fulbright, Chevening, Erasmus Mundus, atau AAS) membutuhkan keseimbangan antara struktur argumen yang kokoh dan suara personal yang otentik. Sebagian besar AI generik cenderung menulis ulang esai mahasiswa menjadi kalimat klise yang terdengar seperti robot, sehingga rentan terdeteksi oleh reviewer dan AI detector.

**EssayMentor AI hadir dengan pendekatan berbeda:**
- **Evaluator, Bukan Ghostwriter:** AI bertindak sebagai mentor berpengalaman yang memberikan skor objektif, catatan kritis, dan anotasi per kalimat tanpa menulis ulang kepribadian mahasiswa.
- **Preservasi Suara Asli (Writing Style Fingerprint):** Mengidentifikasi karakteristik unik kosakata, ritme kalimat, dan gaya bercerita penulis agar saran yang diberikan tetap selaras dengan karakter mahasiswa.
- **Resiliensi Tinggi:** Menggunakan sistem fallback otomatis dari Google Gemini 3.5 Flash-Lite ke DeepSeek, lalu ke Groq (gpt-oss-120b), jika terjadi lonjakan trafik atau limit kuota.

---

## 🚀 Fitur Unggulan

- **Real-Time Streaming Evaluation (SSE):** Respons evaluasi dikirimkan secara live token-demi-token ke browser menggunakan Server-Sent Events, dilengkapi penanganan pemutusan koneksi otomatis (*client disconnect cancellation*) untuk menghemat resource.
- **Routing AI Berdasarkan Paket Akses:** Setiap akun punya `plan` (`FREE` secara default, atau `PRO`). Akun `FREE` dilayani model murah lebih dulu (Groq, lalu DeepSeek) dan Gemini hanya sebagai pilihan terakhir; akun `PRO` dan `ADMIN` dilayani Gemini lebih dulu, lalu DeepSeek dan Groq. Penyedia tanpa API key dilewati, dan jawaban yang kosong atau bukan JSON valid otomatis dilempar ke penyedia berikutnya.
- **Matriks Evaluasi 5 Dimensi:**
  1. *Structure* (Struktur & Alur Logika)
  2. *Tone* (Kesesuaian Nada & Formalitas)
  3. *Relevance* (Relevansi terhadap Visi Beasiswa Target)
  4. *Originality* (Keunikan & Kedalaman Refleksi Diri)
  5. *Impact* (Daya Persuasi & Efek Emosional)
- **Anotasi Kalimat Interaktif:** Penandaan warna semantik langsung pada teks:
  - Hijau: Kekuatan (*Strength*)
  - Kuning: Saran Pengembangan (*Suggestion*)
  - Merah: Catatan Kritis (*Critical*)
  - Biru: Catatan Struktural (*Structural*)
  - Ungu: Kesesuaian Nada (*Tone*)
- **Multi-Language Support (i18n):** Pergantian bahasa instan (Bahasa Indonesia dan English) tanpa reload halaman.
- **Autentikasi & Riwayat Esai:** Sistem login/registrasi berbasis JWT aman dengan penyimpanan riwayat draf untuk melacak progres revisi versi (v1 -> v2).
- **Dark & Light Mode:** Desain antarmuka modern berbasis Tailwind CSS dengan aksesibilitas kontras tinggi (WCAG AA).

---

## 🏗 Arsitektur & Alur Sistem

```mermaid
flowchart LR
    A["Browser Mahasiswa (Next.js 15)"] -->|HTTP / SSE EventStream| B["NestJS 11 API Gateway"]
    B -->|Middleware| C["Helmet + Rate Limiter + CORS"]
    C -->|JWT Auth & RBAC| D["Essay Orchestrator"]
    D -->|Prisma ORM| E[("MySQL 8 Database")]
    D -->|Primary Stream| F["Google Gemini 3.5 Flash-Lite"]
    F -.->|Otomatis Fallback jika Sibuk| G["DeepSeek Flash"]
    G -.->|Fallback berikutnya| H["Groq gpt-oss-120b"]
```

---

## 🛠 Tech Stack

| Layer | Teknologi | Peran |
|---|---|---|
| **Frontend Framework** | Next.js 15 (App Router, React 19) | Server & Client Components, routing dinamis |
| **Frontend Runtime** | Bun | Paket manager dan script runner super cepat |
| **Styling** | Tailwind CSS v4 & Lucide Icons | Desain responsif, dark mode, dan glassmorphism |
| **Backend Framework** | NestJS 11 | API Gateway, dependensi modular, middleware |
| **Backend Runtime** | Node.js 20+ (npm) | Runtime enterprise backend |
| **Database & ORM** | MySQL 8.0 & Prisma 5.22 | Skema relasional, migrasi tipe aman, indexing |
| **AI Primary Engine** | Google Gemini 3.5 Flash-Lite | Evaluasi penalaran cepat dan JSON terstruktur |
| **AI Fallback Engine** | DeepSeek Flash, lalu Groq (gpt-oss-120b) | Cadangan murah dan cepat; provider tanpa API key dilewati |
| **Keamanan** | Helmet, Throttler, Class-Validator | Proteksi OWASP Top 10 API Security |

---

## 📁 Struktur Direktori

```
essaymentor-ai/
├── backend/
│   └── projekai/
│       ├── prisma/
│       │   └── schema.prisma        # Definisi database MySQL & Relasi
│       ├── src/
│       │   ├── auth/                # Modul Autentikasi JWT, Strategy, Roles Guard
│       │   ├── essay/               # Orkestrator AI, SSE Controller, Rubrik Prompt
│       │   ├── prisma/              # Prisma Global Service & Shutdown Hook
│       │   ├── users/               # Manajemen Pengguna & Fingerprint
│       │   ├── app.module.ts        # Root Module & Konfigurasi Throttler
│       │   └── main.ts              # Bootstrap, Helmet, CORS, ValidationPipe
│       └── package.json
│
├── frontend/
│   └── projekai/
│       ├── src/
│       │   └── app/
│       │       ├── about/           # Halaman Tentang & Filosofi
│       │       ├── components/      # Navbar, Footer, Radar Chart
│       │       ├── contexts/        # AuthContext & LanguageContext (i18n)
│       │       ├── dashboard/       # Dashboard Riwayat Draft Mahasiswa
│       │       ├── evaluator/       # Halaman Inti Split-Panel Evaluasi Esai
│       │       ├── login/           # Halaman Masuk
│       │       ├── register/        # Halaman Pendaftaran Akun
│       │       ├── scholarships/    # Katalog Panduan Beasiswa
│       │       ├── tips/            # Tips Menulis Esai
│       │       └── globals.css      # Variabel Tema & Kontras Aksesibilitas
│       └── package.json
│
├── .gitignore                       # Proteksi file rahasia, .env, dan catatan privat
└── README.md
```

---

## ⚡ Panduan Memulai (Quick Start)

### 1. Prasyarat Sistem
- **Node.js:** Versi 20.x atau lebih baru (`node -v`)
- **npm:** Versi 10.x atau lebih baru (`npm -v`)
- **Bun:** Versi 1.1+ untuk frontend (`bun -v`)
- **MySQL:** Versi 8.0+ running lokal atau di cloud

### 2. Clone Repositori
```bash
git clone https://github.com/rafboa/essaymentor-ai.git
cd essaymentor-ai
```

### 3. Konfigurasi Backend
Pindah ke direktori backend:
```bash
cd backend/projekai
npm install
```

Salin file contoh environment:
```bash
cp .env.example .env
```

Buka file `.env` dan sesuaikan nilainya:
```env
DATABASE_URL="mysql://username:password@localhost:3306/projekai"
GEMINI_API_KEY="api-key-google-anda"
DEEPSEEK_API_KEY="api-key-deepseek-anda"
GROQ_API_KEY="api-key-groq-anda"
JWT_SECRET="kunci-rahasia-jwt-acak-minimal-32-karakter"
FRONTEND_URL="http://localhost:3001"
PORT=3000
SEED_USER_PASSWORD="kata-sandi-akun-demo"
SEED_ADMIN_PASSWORD="kata-sandi-akun-admin"
```

`JWT_SECRET` wajib (minimal 32 karakter); server tidak mau berjalan tanpanya. Jangan memakai contoh di atas; buat yang acak, misalnya dengan `openssl rand -hex 32`.

Sinkronkan database dengan Prisma:
```bash
npx prisma generate
npx prisma db push
```

Buat akun demo (`demo@essaymentor.test`, paket `FREE`) dan admin (`admin@essaymentor.test`, paket `PRO`) dengan kata sandi dari `SEED_*_PASSWORD`. Aman dijalankan ulang:
```bash
npm run seed
```

Untuk menaikkan akun ke paket `PRO` (Gemini lebih dulu), ubah kolom `plan` di tabel `users`, misalnya `UPDATE users SET plan = 'PRO' WHERE email = '...';`. Migrasi `user_plan` diterapkan lewat `npx prisma migrate deploy`.

Jalankan server backend:
```bash
npm run start:dev
```
Backend akan aktif di `http://localhost:3000`.

### 4. Konfigurasi Frontend
Buka terminal baru dan pindah ke direktori frontend:
```bash
cd frontend/projekai
bun install
```

Salin file contoh environment (opsional):
```bash
cp .env.example .env.local
```

Jalankan server frontend:
```bash
bun run dev --port 3001
```
Buka browser Anda dan akses: **`http://localhost:3001`**.

---

## 🔌 Daftar Endpoint API

Base URL: `http://localhost:3000`

### Modul Autentikasi
| Method | Endpoint | Deskripsi | Rate Limit |
|---|---|---|---|
| `POST` | `/auth/register` | Mendaftarkan akun mahasiswa baru | 5 req / menit |
| `POST` | `/auth/login` | Autentikasi dan mendapatkan JWT token | 5 req / menit |
| `GET` | `/auth/me` | Mengambil profil user yang sedang login | 60 req / menit |

### Modul Evaluasi Esai
| Method | Endpoint | Deskripsi | Rate Limit | Otorisasi |
|---|---|---|---|---|
| `POST` | `/essay/evaluate-stream` | Evaluasi esai dengan streaming SSE | 5 req / menit | JWT (Bearer) |
| `POST` | `/essay/evaluate` | Evaluasi esai non-streaming | 5 req / menit | JWT (Bearer) |
| `GET` | `/essay/history` | Mengambil daftar riwayat draf user | 60 req / menit | JWT (Bearer) |
| `GET` | `/essay/:id` | Mengambil satu draft beserta skor | 60 req / menit | Pemilik Objek |
| `POST` | `/essay/:id/fingerprint` | Menghitung sidik jari gaya penulisan | 5 req / menit | Pemilik Objek |
| `GET` | `/essay/analytics` | Metrik analitik platform & pemakaian token | 60 req / menit | **Role: ADMIN** |

---

## 🛡 Keamanan & Proteksi API

Aplikasi ini telah melalui audit keamanan menyeluruh dan menerapkan praktik terbaik:
1. **Multi-Tier Throttling:** Mencegah brute force autentikasi (5 percobaan/menit) dan eksploitasi kuota token AI (5 evaluasi/menit).
2. **Reverse Proxy Trust:** Menghindari *IP Collapsing* saat dideploy di balik Nginx, Cloudflare, atau Railway (`trust proxy: 1`).
3. **Penyaringan Input (Class-Validator):** Payload divalidasi secara otomatis. Field esai dibatasi maksimal **25.000 karakter** untuk mencegah serangan Denial of Wallet.
4. **Header Keamanan (Helmet):** Mengaktifkan proteksi CSP, HSTS, X-Frame-Options, dan X-Content-Type-Options.
5. **Role-Based Access Control (RBAC):** Membatasi data operasional sensitif (biaya API dan analitik global) hanya untuk akun administrator. Paket akses (`plan`) hanya menentukan urutan penyedia AI, bukan hak akses data.
6. **Proteksi IDOR:** Memverifikasi kepemilikan draf sebelum mengizinkan pembacaan atau analisis sidik jari.

---

## 📄 Kontribusi & Lisensi

Kontribusi selalu terbuka! Silakan buat *Issue* untuk diskusi fitur atau kirimkan *Pull Request*.

Proyek ini dirilis di bawah lisensi [MIT](LICENSE).
