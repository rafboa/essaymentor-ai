<div align="center">

# 🎓 EssayMentor AI

### *Platform Evaluasi Esai Beasiswa Berbasis AI*

[![Frontend](https://img.shields.io/badge/Frontend-Next.js_16_App_Router-000000?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Backend](https://img.shields.io/badge/Backend-NestJS_11-E0234E?style=for-the-badge&logo=nestjs)](https://nestjs.com/)
[![Database](https://img.shields.io/badge/Database-MySQL_8-4479A1?style=for-the-badge&logo=mysql&logoColor=white)](https://www.mysql.com/)
[![ORM](https://img.shields.io/badge/ORM-Prisma_5.22-2D3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![AI Primary](https://img.shields.io/badge/Primary_AI-Gemini_2.5_Flash-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![AI Fallback](https://img.shields.io/badge/Fallback_AI-Groq_Llama_3.3-F55036?style=for-the-badge&logo=openai&logoColor=white)](https://groq.com/)

**Status:** MVP &nbsp;·&nbsp; **Backend Runtime:** Node.js (npm) &nbsp;·&nbsp; **Frontend Runtime:** Bun

</div>

---

## Daftar Isi

- [Tentang Proyek](#tentang-proyek)
- [Arsitektur & Tech Stack](#arsitektur--tech-stack)
- [Struktur Direktori](#struktur-direktori)
- [Alur Data End-to-End](#alur-data-end-to-end)
- [Database Schema](#database-schema)
- [AI Strategy & Prompt Engineering](#ai-strategy--prompt-engineering)
- [API Endpoints](#api-endpoints)
- [Quick Start](#quick-start)
- [Konfigurasi Environment](#konfigurasi-environment)
- [Perintah Berguna](#perintah-berguna)
- [Roadmap](#roadmap)

---

## Tentang Proyek

EssayMentor AI adalah platform yang membantu mahasiswa Indonesia menyusun, mengevaluasi, dan memperbaiki esai beasiswa menggunakan kecerdasan buatan. Platform ini **bukan ChatGPT wrapper** — ia dirancang dengan prompt engineering multi-layer yang secara eksplisit mempertahankan **personal voice** (keaslian gaya tulisan) mahasiswa.

### Diferensiasi Utama

| Aspek | ChatGPT / AI Generik | EssayMentor AI |
|-------|----------------------|----------------|
| Output | Prosa bebas, tidak terstruktur | JSON terstruktur dengan skor 1-100 per dimensi |
| Gaya tulisan | Menulis ulang kalimat pengguna | **Dilarang keras** mengubah kalimat asli |
| Evaluasi | Generik ("sudah bagus") | 5 dimensi spesifik + anotasi per kalimat |
| Konteks | Tidak paham beasiswa | Rubrik khusus per jenis beasiswa |
| Persistensi | Tidak ada | Draft & feedback tersimpan di MySQL |

### Core Features (MVP)

- **Multi-Page Dark Glassmorphism** — UI modern yang memukau (Home, Evaluator, Scholarships, Tips, About).
- **Multi-Language (i18n)** — Toggle instan antara Bahasa Indonesia dan English.
- **AI Fallback System** — Evaluasi menggunakan **Gemini 2.5 Flash** sebagai mesin utama, dengan fallback otomatis ke **Groq (Llama 3.3)** jika token/kuota habis.
- **Split-panel dashboard** — panel kiri untuk menulis esai, panel kanan untuk melihat hasil evaluasi.
- **Evaluasi AI 5 dimensi** — Structure, Tone, Relevance, Originality, Impact (skor 1-100).
- **Anotasi per kalimat** — warna semantik (hijau/kuning/merah/biru/ungu) langsung pada teks.
- **Voice preservation** — indikator apakah saran AI mempertahankan gaya tulisan asli.
- **Persistensi** — draft esai dan feedback AI tersimpan ke MySQL via Prisma.

---

## Arsitektur & Tech Stack

```
┌──────────────────────────────────────────────────────────────┐
│                      FRONTEND (Bun)                          │
│                                                              │
│   Next.js 16 (App Router) + Tailwind CSS v4 + React 19      │
│   Port: 3001                                                 │
│                                                              │
│   src/app/                                                   │
│   ├── layout.tsx      Root layout (Inter font, SEO)          │
│   ├── globals.css     Design system (palet Academic Warmth)  │
│   └── page.tsx        Dashboard MVP (split-panel)            │
│                                                              │
└────────────────────────────┬─────────────────────────────────┘
                             │ fetch POST /essay/evaluate
                             │ (JSON over HTTP)
┌────────────────────────────▼─────────────────────────────────┐
│                      BACKEND (npm)                           │
│                                                              │
│   NestJS 11 + TypeScript + Express                           │
│   Port: 3000                                                 │
│                                                              │
│   src/                                                       │
│   ├── prisma/         PrismaModule (@Global)                 │
│   │   ├── prisma.module.ts                                   │
│   │   └── prisma.service.ts                                  │
│   ├── essay/          EssayModule                            │
│   │   ├── essay.module.ts                                    │
│   │   ├── essay.controller.ts   REST endpoints               │
│   │   ├── essay.service.ts      Orchestrator utama           │
│   │   ├── gemini.config.ts      System prompt + config       │
│   │   └── dto/                                               │
│   │       └── submit-essay.dto.ts                            │
│   ├── app.module.ts   Root module                            │
│   └── main.ts         Bootstrap + shutdown hooks             │
│                                                              │
└─────────────┬──────────────────────────┬─────────────────────┘
              │                          │
              ▼                          ▼
┌─────────────────────┐    ┌─────────────────────────┐
│   MySQL 8.0+        │    │   Google Gemini API      │
│                     │    │   (gemini-2.5-flash)     │
│   Tabel:            │    │                         │
│   • users           │    │   SDK:                  │
│   • essay_drafts    │    │   @google/generative-ai │
│   • ai_feedbacks    │    │                         │
│                     │    │                         │
│   ORM: Prisma 5.22  │    │                         │
└─────────────────────┘    └─────────────────────────┘
```

### Justifikasi Tech Stack

| Teknologi | Versi | Alasan |
|-----------|-------|--------|
| **Next.js** | 16.2.9 | App Router, React Server Components, optimasi font/image bawaan |
| **Tailwind CSS** | v4 | `@theme` inline untuk design token, zero-config dengan PostCSS |
| **NestJS** | 11 | Arsitektur modular, DI container, decorator routing, TypeScript-first |
| **Prisma** | 5.22 | Type-safe queries, declarative schema, migration system |
| **MySQL** | 8.0+ | ACID compliance, JSON column support, full-text search |
| **Gemini** | 2.5 Flash | Respons cepat, output terstruktur, cost-efficient |
| **npm** (backend) | — | Kompatibilitas NestJS CLI dan ecosystem |
| **bun** (frontend) | — | Instalasi cepat, native TS, startup time rendah |

---

## Struktur Direktori

```
Kuliah/AI/
├── README.md                              ← Dokumen ini
│
├── backend/projekai/                      ← NestJS Application (npm)
│   ├── src/
│   │   ├── app.module.ts                  Root module (import Prisma + Essay)
│   │   ├── app.controller.ts              Health check endpoint
│   │   ├── app.service.ts                 Default service
│   │   ├── main.ts                        Bootstrap + graceful shutdown
│   │   │
│   │   ├── prisma/                        Database layer (@Global)
│   │   │   ├── prisma.module.ts           Global module export
│   │   │   └── prisma.service.ts          Extends PrismaClient, lifecycle
│   │   │
│   │   └── essay/                         Essay evaluation feature
│   │       ├── essay.module.ts            Feature module
│   │       ├── essay.controller.ts        3 REST endpoints
│   │       ├── essay.service.ts           Orchestrator: DB ↔ Gemini ↔ Response
│   │       ├── gemini.config.ts           System prompt + generation config
│   │       └── dto/
│   │           └── submit-essay.dto.ts    Request body shape
│   │
│   ├── prisma/
│   │   └── schema.prisma                  3 model + 2 enum
│   │
│   ├── .env                               DATABASE_URL + GEMINI_API_KEY
│   ├── package.json                       Dependencies (npm)
│   └── tsconfig.json                      nodenext module resolution
│
└── frontend/projekai/                     ← Next.js Application (bun)
    ├── src/app/
    │   ├── layout.tsx                     Root layout (Inter, SEO metadata)
    │   ├── globals.css                    Design system + animasi
    │   └── page.tsx                       Dashboard MVP (split-panel)
    │
    ├── public/                            Aset statis
    ├── package.json                       Dependencies (bun)
    ├── bun.lock                           Lockfile bun
    ├── next.config.ts                     React Compiler enabled
    ├── postcss.config.mjs                 Tailwind v4 plugin
    └── tsconfig.json                      TypeScript config
```

---

## Alur Data End-to-End

Berikut alur saat mahasiswa menekan tombol **"Evaluasi Esai"** di dashboard:

```
  Mahasiswa menulis esai di textarea
  Pilih beasiswa target dari dropdown
  Klik "🔍 Evaluasi Esai"
           │
           ▼
  ┌─ Frontend (page.tsx) ──────────────────────────────────┐
  │  handleEvaluate()                                      │
  │  → setIsLoading(true)                                  │
  │  → fetch POST http://localhost:3000/essay/evaluate      │
  │    body: { userId, title, scholarshipTarget, content }  │
  └──────────────────────────┬─────────────────────────────┘
                             │
                             ▼
  ┌─ Backend (essay.service.ts) ───────────────────────────┐
  │                                                        │
  │  1. Validasi input (min 50 karakter, userId wajib)     │
  │                                                        │
  │  2. prisma.essayDraft.create()                         │
  │     → Simpan teks ASLI ke MySQL, status: IN_REVIEW     │
  │                                                        │
  │  3. Rakit prompt:                                      │
  │     SYSTEM_PROMPT (persona + rubrik + voice rules)     │
  │     + USER_PROMPT (scholarship target + esai)          │
  │                                                        │
  │  4. model.generateContent(prompt)                      │
  │     → Kirim ke Gemini API                              │
  │                                                        │
  │  5. parseGeminiResponse()                              │
  │     → Bersihkan markdown fence                         │
  │     → JSON.parse + validasi field + clamp skor 1-100   │
  │                                                        │
  │  6. prisma.aiFeedback.create()                         │
  │     → Simpan evaluasi ke MySQL                         │
  │                                                        │
  │  7. prisma.essayDraft.update()                         │
  │     → Cache skor di draft, status: DRAFT               │
  │                                                        │
  │  8. Return { draft, evaluation }                       │
  └──────────────────────────┬─────────────────────────────┘
                             │
                             ▼
  ┌─ Frontend (ResultPanel) ───────────────────────────────┐
  │  • Composite score circle (warna dinamis)              │
  │  • 5 score bars dengan animasi fill                    │
  │  • Voice preservation badge (hijau/kuning)             │
  │  • Rangkuman evaluasi                                  │
  │  • Kekuatan utama + prioritas perbaikan                │
  │  • Anotasi per kalimat (5 tipe warna)                  │
  └────────────────────────────────────────────────────────┘
```

---

## Database Schema

Prisma schema (`backend/projekai/prisma/schema.prisma`) mendefinisikan 3 model dan 2 enum:

### Entity-Relationship Diagram

```
┌──────────────────────┐
│        User          │
├──────────────────────┤
│ id            (PK)   │
│ email         (UQ)   │
│ fullName             │
│ passwordHash         │
│ university           │
│ major                │
│ graduationYear       │
│ writingStyleFinger.. │─── JSON (gaya tulisan)
│ createdAt            │
│ updatedAt            │
└──────────┬───────────┘
           │ 1:N
           ▼
┌──────────────────────┐
│     EssayDraft       │
├──────────────────────┤
│ id            (PK)   │
│ userId        (FK)   │→ User.id (CASCADE)
│ title                │
│ scholarshipTarget    │
│ content              │─── LONGTEXT (esai asli)
│ status               │─── DRAFT | IN_REVIEW | FINALIZED
│ version              │
│ compositeScore       │┐
│ structureScore       ││
│ toneScore            ││ Skor cache dari
│ relevanceScore       ││ AiFeedback terakhir
│ originalityScore     ││
│ impactScore          │┘
│ totalWordCount       │
│ createdAt            │
│ updatedAt            │
└──────────┬───────────┘
           │ 1:N
           ▼
┌──────────────────────┐
│     AiFeedback       │
├──────────────────────┤
│ id            (PK)   │
│ draftId       (FK)   │→ EssayDraft.id (CASCADE)
│ feedbackType         │─── PARAGRAPH | FULL_ESSAY | TONE_CHECK | FINAL_REVIEW
│ scores               │─── JSON { structure, tone, relevance, originality, impact }
│ annotations          │─── JSON [{ sentenceIndex, type, message }]
│ overallComment       │─── TEXT
│ voicePreserved       │─── BOOLEAN
│ modelVersion         │
│ promptTokens         │
│ responseTokens       │
│ processingTimeMs     │
│ rawPrompt            │─── LONGTEXT (dev only)
│ rawResponse          │─── LONGTEXT (dev only)
│ createdAt            │
└──────────────────────┘
```

### Indexes

| Tabel | Index | Tujuan |
|-------|-------|--------|
| `users` | `email` | Lookup cepat saat login |
| `essay_drafts` | `userId` | Ambil semua draft milik user |
| `essay_drafts` | `userId, status` | Filter draft berdasarkan status |
| `essay_drafts` | `createdAt` | Sorting kronologis |
| `ai_feedbacks` | `draftId` | Ambil feedback untuk draft tertentu |
| `ai_feedbacks` | `feedbackType` | Filter berdasarkan jenis evaluasi |
| `ai_feedbacks` | `createdAt` | Sorting kronologis |

---

## AI Strategy & Prompt Engineering

### Arsitektur Prompt 4 Layer

System prompt di `gemini.config.ts` dirancang dengan teknik multi-layer:

| Layer | Fungsi | Detail |
|-------|--------|--------|
| **1. Persona** | Identitas AI | "Dr. Mentor" — evaluator berpengalaman 15 tahun. Peran: **EVALUATOR**, bukan penulis. |
| **2. Rubrik** | Standar evaluasi | 5 dimensi (Structure, Tone, Relevance, Originality, Impact) dengan deskripsi per rentang skor. |
| **3. Voice Guard** | Preservasi keaslian | 6 aturan ketat yang melarang AI menulis ulang kalimat mahasiswa. |
| **4. JSON Schema** | Format output | Spesifikasi JSON yang kaku — tidak ada prosa, tidak ada markdown. |

### Aturan Voice Preservation (Layer 3)

Aturan berikut ditegakkan di dalam system prompt:

1. ❌ **DILARANG** menulis ulang kalimat mahasiswa
2. ❌ **DILARANG** memberikan contoh kalimat pengganti
3. ✅ Saran harus dalam format **instruksi**, bukan contoh kalimat jadi
4. ✅ Idiom daerah dan gaya bercerita unik **tidak boleh** dikoreksi
5. ✅ Pilihan diksi mahasiswa **dihormati**, kecuali jelas salah gramatikal
6. ✅ Field `voicePreserved` di output = `true` hanya jika semua saran mematuhi aturan

### Contoh Output JSON dari Gemini

```json
{
  "scores": {
    "structure": 72,
    "tone": 85,
    "relevance": 68,
    "originality": 91,
    "impact": 77
  },
  "compositeScore": 79,
  "annotations": [
    {
      "sentenceIndex": 0,
      "type": "STRENGTH",
      "message": "Opening yang kuat — detail sensorik membuat pembaca langsung terhubung."
    },
    {
      "sentenceIndex": 2,
      "type": "SUGGESTION",
      "message": "Pertimbangkan menambahkan koneksi eksplisit antara pengalaman ini dan tujuan studi Anda."
    }
  ],
  "overallComment": "Esai ini memiliki narasi personal yang kuat dan otentik...",
  "topStrengths": [
    "Opening hook yang vivid dan memorable",
    "Narasi personal yang tidak terasa generik"
  ],
  "topImprovements": [
    "Perkuat koneksi antara pengalaman pribadi dan relevansi beasiswa target",
    "Tambahkan rencana konkret pasca-studi di paragraf penutup"
  ],
  "voicePreserved": true
}
```

### Konfigurasi Generasi

| Parameter | Nilai | Alasan |
|-----------|-------|--------|
| `temperature` | 0.3 | Konsistensi evaluasi antar request |
| `topP` | 0.8 | Keseimbangan kreativitas dan presisi |
| `topK` | 40 | Mencegah token yang terlalu eksotis |
| `maxOutputTokens` | 4096 | Cukup untuk evaluasi detail |

---

## API Endpoints

Base URL: `http://localhost:3000`

### Essay Module

| Method | Endpoint | Deskripsi | Request Body |
|--------|----------|-----------|--------------|
| `POST` | `/essay/evaluate` | Submit esai + evaluasi AI + simpan ke DB | `{ userId, title?, scholarshipTarget?, content }` |
| `GET` | `/essay/user/:userId` | Ambil semua draft milik user | — |
| `GET` | `/essay/:id` | Ambil satu draft + feedback terakhir | — |

### Contoh Request

```bash
curl -X POST http://localhost:3000/essay/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-001",
    "title": "Esai LPDP Saya",
    "scholarshipTarget": "LPDP RI 2026",
    "content": "Saat saya berusia 12 tahun, Ibu saya mengajak saya ke perpustakaan kota untuk pertama kalinya. Di sana, saya menemukan buku tentang teknologi yang mengubah pandangan hidup saya sepenuhnya."
  }'
```

### Contoh Response

```json
{
  "draft": {
    "id": "clx1abc...",
    "title": "Esai LPDP Saya",
    "scholarshipTarget": "LPDP RI 2026",
    "content": "Saat saya berusia 12 tahun...",
    "wordCount": 32,
    "status": "DRAFT",
    "scores": {
      "composite": 79,
      "structure": 72,
      "tone": 85,
      "relevance": 68,
      "originality": 91,
      "impact": 77
    },
    "createdAt": "2026-06-11T..."
  },
  "evaluation": {
    "feedbackId": "clx2def...",
    "compositeScore": 79,
    "scores": { "structure": 72, "tone": 85, "relevance": 68, "originality": 91, "impact": 77 },
    "annotations": [ ... ],
    "overallComment": "...",
    "topStrengths": [ "...", "..." ],
    "topImprovements": [ "...", "..." ],
    "voicePreserved": true,
    "processingTimeMs": 8432
  }
}
```

---

## Quick Start

### Prasyarat

| Software | Versi Minimum | Verifikasi |
|----------|--------------|------------|
| **Node.js** | v20+ | `node --version` |
| **npm** | v10+ | `npm --version` |
| **Bun** | v1.2+ | `bun --version` |
| **MySQL** | v8.0+ | `mysql --version` |

### Langkah Instalasi

```bash
# ─── 1. CLONE REPOSITORY ───────────────────────────────
git clone <repository-url>
cd Kuliah/AI

# ─── 2. SETUP DATABASE ─────────────────────────────────
# Buat database MySQL terlebih dahulu:
mysql -u root -p -e "CREATE DATABASE projekai;"

# ─── 3. SETUP BACKEND (npm) ────────────────────────────
cd backend/projekai
npm install                             # Install dependencies
#
# Edit file .env:
#   DATABASE_URL="mysql://root:PASSWORD@localhost:3306/projekai"
#   GEMINI_API_KEY="api-key-dari-aistudio.google.com"
#
npx prisma generate                     # Generate Prisma Client
npx prisma migrate dev --name init      # Buat tabel di MySQL

# ─── 4. SETUP FRONTEND (bun) ───────────────────────────
cd ../../frontend/projekai
bun install                             # Install dependencies

# ─── 5. JALANKAN ────────────────────────────────────────
# Terminal 1 — Backend (port 3000)
cd backend/projekai
npm run start:dev

# Terminal 2 — Frontend (port 3001)
cd frontend/projekai
bun run dev --port 3001

# ─── 6. BUKA BROWSER ───────────────────────────────────
# http://localhost:3001
```

---

## Konfigurasi Environment

File: `backend/projekai/.env`

```env
# Koneksi MySQL
DATABASE_URL="mysql://root:PASSWORD@localhost:3306/projekai"

# Google Gemini API Key (Model Utama)
# Dapatkan di: https://aistudio.google.com/apikey
GEMINI_API_KEY="your-gemini-api-key"

# Groq API Key (Model Fallback)
# Dapatkan di: https://console.groq.com/keys
GROQ_API_KEY="your-groq-api-key"
```

File (opsional): `frontend/projekai/.env.local`

```env
# Override jika backend berjalan di port/host berbeda
NEXT_PUBLIC_API_URL="http://localhost:3000"
```

---

## Perintah Berguna

### Backend (npm)

```bash
cd backend/projekai

npm run start:dev          # Dev server (hot reload)
npm run build              # Compile TypeScript
npm run start:prod         # Jalankan build produksi

npx prisma studio          # GUI browser database
npx prisma migrate dev     # Buat migrasi baru
npx prisma generate        # Regenerate Prisma Client
npx prisma validate        # Validasi schema.prisma
```

### Frontend (bun)

```bash
cd frontend/projekai

bun run dev                # Dev server (hot reload)
bun run build              # Production build
bun run lint               # ESLint check
```

---

## Roadmap

### Fase 1 — MVP ✅ (Selesai)

- [x] Backend NestJS dengan PrismaModule dan EssayModule
- [x] Prisma schema: User, EssayDraft, AiFeedback
- [x] Integrasi Gemini API dengan system prompt multi-layer
- [x] REST endpoint POST /essay/evaluate
- [x] Frontend Next.js dashboard split-panel
- [x] Loading state, error handling, empty state
- [x] Score visualization (composite circle + 5 bar chart)
- [x] Anotasi per kalimat dengan warna semantik

### Fase 2 — Auth & Polish (Rencana)

- [ ] Autentikasi (JWT + bcrypt) — register, login, protected routes
- [ ] Profil pengguna dan riwayat draft
- [ ] Iterative draft versioning (v1 → v2 → v3)
- [ ] CORS configuration untuk production

### Fase 3 — Advanced Features (Rencana)

- [ ] Evaluasi per paragraf (selain full-essay)
- [ ] Radar chart visualisasi 5 dimensi
- [ ] Writing style fingerprint (gaya tulisan lintas esai)
- [ ] Real-time streaming response dari Gemini
- [ ] Dark mode toggle

### Fase 4 — Production (Rencana)

- [ ] Containerization (Docker Compose)
- [ ] CI/CD pipeline
- [ ] Rate limiting dan API key rotation
- [ ] Monitoring (token usage, cost tracking)
- [ ] Deployment ke cloud (Vercel + Railway/Render)

---

<div align="center">

**Dibuat untuk mahasiswa Indonesia yang bermimpi meraih beasiswa dunia.** 🇮🇩

*EssayMentor AI — Mentor digitalmu, bukan penulis penggantimu.*

</div>
