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
4. **Bundler Next.js tidak menyertakan Prisma Query Engine** (`libquery_engine-*.so.node`) untuk target runtime Linux (`rhel-openssl-3.0.x`).
5. **Fallback featured list ada, tapi detail slug fallback ikut query DB** sehingga klik card fallback bisa gagal jika tidak ada fallback detail handler.
6. **Prisma client dibuat ulang terlalu sering di runtime** dapat memicu lonjakan koneksi dan kegagalan inisialisasi DB (`503`) pada traffic burst/cold start beruntun.

Perbaikan final pada codebase ini:
- Resolver DB otomatis memilih public DB URL env saat runtime Vercel + internal host terdeteksi.
- Startup bootstrap deterministic (`prisma generate` -> schema apply -> optional seed -> `next start`).
- Prisma client di-cache lintas warm invocation runtime agar tidak membuat koneksi baru berulang untuk URL DB yang sama.
- Migration history disimpan di repo (`prisma/migrations`).
- Featured endpoint punya controlled fallback dan detail fallback slug juga tersedia.
- Error handling strict + eksplisit (tanpa silent catch suppression).
- Prisma client generator sekarang menyertakan `binaryTargets` untuk runtime Linux production (`rhel-openssl-3.0.x`) agar query engine tersedia di deploy serverless.
- Next config menandai `@prisma/client` sebagai `serverExternalPackages` dan menambahkan `outputFileTracingIncludes` untuk `.prisma/client` supaya engine tidak terbuang saat bundling.

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

#### Nama public URL yang didukung resolver (dicoba berurutan + fallback)
- `DATABASE_URL_PUBLIC`
- `DATABASE_PUBLIC_URL`

Resolver runtime sekarang memakai **semua** env public URL eksplisit di atas sebagai kandidat fallback saat `DATABASE_URL` mengarah ke host internal (`*.railway.internal`). Ini mencegah single-point-of-failure saat salah satu endpoint public mati/rotate.

Contoh konfigurasi yang benar untuk kasus kamu:
- `DATABASE_URL=postgresql://postgres:***@postgres.railway.internal:5432/railway` (internal Railway)
- `DATABASE_PUBLIC_URL=postgresql://postgres:***@shortline.proxy.rlwy.net:11176/railway?sslmode=require` (publik untuk Vercel)

Kesalahan paling umum:
- `DATABASE_URL` di Vercel diisi URL internal Railway.
- URL publik tidak menyertakan `sslmode=require` pada endpoint Railway proxy.
- Hanya mengisi satu URL public padahal endpoint itu sedang tidak reachable dari runtime (misalnya isu routing/IPv6).
- Password user database pada URL publik berbeda dari URL internal (`P1000 authentication failed`).
- `DATABASE_URL` internal tetapi `DATABASE_PUBLIC_URL` / `DATABASE_URL_PUBLIC` belum diisi.
- `DATABASE_PUBLIC_URL` / `DATABASE_URL_PUBLIC` masih memakai host internal (`*.railway.internal`).

Contoh transform URL yang kamu kirim:
- sebelum: `postgresql://postgres:***@shortline.proxy.rlwy.net:11176/railway`
- sesudah: `postgresql://postgres:***@shortline.proxy.rlwy.net:11176/railway?sslmode=require`


### Root cause spesifik dari log kamu (referensi salah di mana)
- `password authentication failed for user "postgres"` berarti credential pada URL yang dipakai runtime **tidak cocok** dengan PostgreSQL saat ini.
- Karena error muncul saat akses domain Vercel, referensi yang salah biasanya ada di env Vercel: `DATABASE_URL_PUBLIC` / `DATABASE_PUBLIC_URL` masih pakai password lama.
- Service Railway app (startup migrate) bisa tetap sukses pakai `DATABASE_URL` internal, sementara Vercel tetap gagal jika public URL tidak sinkron.

Checklist sinkronisasi:
1. Ambil ulang **public connection string terbaru** dari Railway Postgres service.
2. Set di Vercel `DATABASE_URL_PUBLIC` (atau `DATABASE_PUBLIC_URL`) persis sama + `?sslmode=require`.
3. Redeploy Vercel setelah update env.
4. Cek `/api/health` dan pastikan `dbSource` menunjukkan `DATABASE_URL_PUBLIC`/`DATABASE_PUBLIC_URL` dan `runtime` = `vercel`.

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


### F. Debug 400 pada `POST /api/templates`
Jika frontend menampilkan `400 Bad Request`, cek ini berurutan:
1. Payload wajib berisi `title`, `summary`, `content`, `type`, `tags`, dan salah satu `ownerRef` atau `ownerId`.
2. Constraint validasi:
   - `title`: 3..120 karakter
   - `summary`: 10..300 karakter
   - `content`: minimal 10 karakter
   - `type`: CODE/IDEA/STORY/OTHER
   - `ownerRef`/`ownerId`: 2..64 karakter
   - `tags`: maksimal 12 item, tiap tag 1..30 karakter
3. `ownerRef` bisa berupa:
   - user id existing, atau
   - username existing, atau
   - nama baru (server otomatis membuat owner via upsert aman).
4. Jika masih gagal, lihat response `error` dari API (sekarang detail field-level).

Contoh payload valid:
```json
{
  "title": "Universal API Boilerplate",
  "summary": "Template API universal untuk proyek open source.",
  "content": "Isi lengkap template minimal 10 karakter...",
  "type": "CODE",
  "tags": ["api", "boilerplate"],
  "ownerRef": "globaldev"
}
```

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
