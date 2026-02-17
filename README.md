# TemplateDatabase

Platform open source global untuk menyimpan template universal (code, ide, cerita, dll) dengan performa ringan, smart search, featured templates, tombol copy, dan alur contribute.

## Stack Produksi
- Frontend + API: Next.js 14 (Vercel / Railway Runtime)
- Database: PostgreSQL (Railway)
- ORM: Prisma
- Validation: Zod

## Deep-Dive Root Cause (Kenapa Bisa 503)
Kasus `/api/templates?featured=1` menghasilkan 503 umumnya karena kombinasi ini:
1. **Vercel membaca `DATABASE_URL` internal Railway** (`*.railway.internal`) yang tidak bisa diakses dari jaringan publik Vercel.
2. **Schema DB belum sinkron** saat route dipanggil (startup race sebelum migrasi diterapkan).
3. **Runtime install mode production** menghilangkan binary yang dibutuhkan bootstrap kalau dependency salah tempat.
4. **Fallback featured list ada, tapi detail slug fallback ikut query DB** sehingga klik card fallback bisa gagal jika tidak ada fallback detail handler.

Perbaikan final pada codebase ini:
- Resolver DB otomatis memilih public DB URL env saat runtime Vercel + internal host terdeteksi.
- Startup bootstrap deterministic (`prisma generate` -> schema apply -> optional seed -> `next start`).
- Migration history disimpan di repo (`prisma/migrations`).
- Featured endpoint punya controlled fallback dan detail fallback slug juga tersedia.
- Error handling strict + eksplisit (tanpa silent catch suppression).

---

## Step-by-Step Setup (SUPER DETAIL)

### A. Setup Railway PostgreSQL
1. Buat project PostgreSQL di Railway.
2. Ambil 2 jenis URL:
   - Internal URL (biasanya `*.railway.internal`) untuk service dalam network Railway.
   - Public URL untuk akses dari Vercel/public runtime.
3. Pastikan public URL pakai SSL (`?sslmode=require` jika diperlukan provider).

### B. Setup Environment Variables
Atur env berikut:

#### Wajib
- `DATABASE_URL`

#### Sangat disarankan (khusus Vercel jika DATABASE_URL internal)
- `DATABASE_URL_PUBLIC`

#### Alternatif nama yang juga didukung resolver
- `DATABASE_PUBLIC_URL`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL`

Resolver runtime memilih kandidat public di atas saat:
- runtime = Vercel, dan
- host `DATABASE_URL` berakhiran `.railway.internal`.

### C. Setup Deploy di Vercel
1. Import repo ke Vercel.
2. Set environment variables di Project Settings.
3. Build command: `npm run build`
4. Start command: `npm run start`
5. Redeploy setelah semua env terpasang.

### D. Setup Deploy di Railway Runtime (Opsional untuk App)
Repo sudah menyiapkan:
- `nixpacks.toml`
- `railway.toml`
- healthcheck `/api/health`

Runtime start akan otomatis:
1. `prisma generate`
2. `prisma migrate deploy` (jika migrasi tersedia)
3. fallback `prisma db push --skip-generate` bila folder migrasi tidak ada
4. optional seed jika `RUN_DB_SEED=true`
5. `next start -p $PORT`

### E. Verifikasi Produksi
Cek endpoint ini setelah deploy:
1. `GET /api/health` -> harus `200`.
2. `GET /api/templates?featured=1` -> harus `200`.
   - jika DB normal: data real DB.
   - jika DB unavailable: fallback response + header `X-TemplateData-Source: fallback`.
3. Klik card featured fallback (slug fallback) -> detail tetap bisa dibuka.

---

## Menjalankan Lokal
```bash
npm install
cp .env.example .env
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

## API Penting
- `GET /api/health`
- `GET /api/templates?featured=1`
- `POST /api/templates`
- `GET /api/templates/[slug]`
- `POST /api/contributions`
- `GET /api/search?q=...`

## Catatan Integritas Data
- Pembuatan template menangani race slug dengan retry di unique conflict.
- `ownerRef` pada create template bisa berupa:
  - user id,
  - username,
  - atau nama baru (akan dibuatkan user secara aman via upsert username ter-normalisasi).
- Kontribusi ditolak jika user adalah owner template.

## Struktur
- `app/` Next.js app routes + API routes.
- `components/` Komponen UI.
- `lib/` DB, env resolution, errors, validation, helpers.
- `prisma/` schema, migrations, seed.
- `scripts/` startup bootstrap produksi.

## Open Source Notes
- Kode strict TypeScript.
- Error handling operasional eksplisit.
- Deployment flow deterministik.
