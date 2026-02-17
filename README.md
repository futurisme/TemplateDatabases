# TemplateDatabase

Platform open source global untuk menyimpan template universal (code, ide, cerita, dll) dengan performa ringan, smart search, featured templates, tombol copy, dan alur contribute.

## Stack Produksi (100% free-tier)
- **Frontend + API**: Next.js 14 di **Vercel**
- **Database**: PostgreSQL di **Railway Cloud Database**
- **ORM**: Prisma
- **Search**: PostgreSQL full-text + ranking

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
2. Copy `DATABASE_URL`.

### 2) Vercel
1. Import repo ini ke Vercel.
2. Set env var `DATABASE_URL`.
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
- `lib/` utilitas, validasi schema, DB client.
- `prisma/` schema database dan seed data.

## Catatan Open Source
- Kode rapi, strict TypeScript, mudah di-scale.
- Tanpa placeholder/TODO.
