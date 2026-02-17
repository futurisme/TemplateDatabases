# TemplateDatabase

Platform open source global untuk menyimpan template universal (code, ide, cerita, dll) dengan performa ringan, smart search, featured templates, tombol copy, dan alur contribute.

## Stack Produksi (100% free-tier)
- **Frontend + API**: Next.js 14.2.35 di **Vercel**
- **Database**: PostgreSQL di **Railway Cloud Database**
- **ORM**: Prisma
- **Search**: PostgreSQL full-text + ranking

## Audit Arsitektur & Perbaikan Root Cause
- Dependency vulnerability diperbaiki di level akar dengan upgrade `next` dan `eslint-config-next` ke `14.2.35`.
- Fallback data in-memory yang menutupi error DB dihapus agar tidak ada silent failure.
- Error handling backend dibuat eksplisit dengan typed errors dan HTTP status yang konsisten.
- Potensi race condition slug creation diselesaikan dengan retry strategy terhadap unique constraint conflict.
- Detail template sekarang menggunakan endpoint slug-spesifik (`/api/templates/[slug]`) agar efisien dan konsisten data integrity.
- Validasi referential integrity ditambahkan pada pembuatan template (owner harus ada) dan contribution (template + user harus ada).


## Penyebab 500 di Vercel (Root Cause)
- Jangan gunakan host private Railway (`*.railway.internal`) pada Vercel karena tidak dapat diakses dari jaringan publik Vercel.
- Gunakan `DATABASE_URL` public connection string dari Railway (TCP/SSL public), bukan internal DNS URL.
- Setelah env diperbaiki, homepage tetap tidak akan crash total karena data featured dimuat via client + API dengan error state eksplisit.

## Fitur Utama
- Homepage dengan featured templates.
- Smart search cepat (`/api/search`).
- Template detail dengan:
  - Tombol **Copy** konten template.
  - Tombol **Contribute** hanya jika user bukan owner.
- Endpoint backend untuk create template dan contribution.
- Optimasi performa: server rendering, cache headers, compressed responses (`next.config` compress).

## Menjalankan Lokal
```bash
npm install
cp .env.example .env
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

## Deployment

### 1) Railway (Database)
1. Buat project PostgreSQL di Railway.
2. Copy private `DATABASE_URL` (boleh `*.railway.internal` untuk service dalam private network Railway).

### 2) Vercel
1. Import repo ini ke Vercel.
2. Set env var `DATABASE_URL` dan jika nilainya `*.railway.internal`, tambahkan `DATABASE_URL_PUBLIC` (public Railway URL + SSL) khusus untuk runtime Vercel.
3. Build command: `npm run build`
4. Start command: `npm run start`

### 3) Migrasi
Jalankan di Vercel post-deploy atau CI:
```bash
npm run db:migrate
npm run db:seed
```

## Struktur
- `app/` Next.js pages + API routes.
- `components/` UI modular ringan.
- `lib/` utilitas, validasi schema, error handling, DB client.
- `prisma/` schema database dan seed data.

## Catatan Open Source
- Kode rapi, strict TypeScript, mudah di-scale.
- Tanpa placeholder/TODO.
