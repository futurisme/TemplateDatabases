import { PrismaClient, TemplateType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await Promise.all([
    prisma.user.upsert({
      where: { username: 'akbar' },
      update: {},
      create: { username: 'akbar', displayName: 'Fadhil Akbar' }
    }),
    prisma.user.upsert({
      where: { username: 'globaldev' },
      update: {},
      create: { username: 'globaldev', displayName: 'Global Dev' }
    })
  ]);

  const templates = [
    {
      slug: 'ultra-fast-nextjs-boilerplate',
      title: 'Ultra Fast Next.js Boilerplate',
      summary: 'Template kode dengan setup production Vercel + Railway + Prisma.',
      content: 'Starter siap produksi: auth, API routes, metrics, edge cache, dan CI.',
      type: TemplateType.CODE,
      tags: ['nextjs', 'prisma', 'vercel', 'railway'],
      featured: true,
      ownerId: users[0].id
    },
    {
      slug: 'startup-idea-ai-lms',
      title: 'Startup Idea: AI-Powered LMS',
      summary: 'Blueprint ide produk edukasi adaptif berbasis AI.',
      content: 'Market, GTM, model bisnis, dan arsitektur teknologi lengkap.',
      type: TemplateType.IDEA,
      tags: ['ai', 'edtech', 'startup'],
      featured: true,
      ownerId: users[1].id
    },
    {
      slug: 'short-story-neon-rain',
      title: 'Short Story: Neon Rain',
      summary: 'Template cerita cyberpunk pendek siap remix.',
      content: 'Malam turun di kota Neo-Jakarta. Hujan neon memantul di visor tua...',
      type: TemplateType.STORY,
      tags: ['story', 'cyberpunk'],
      featured: true,
      ownerId: users[1].id
    }
  ];

  for (const t of templates) {
    await prisma.template.upsert({
      where: { slug: t.slug },
      update: {
        ...t,
        searchDocument: `${t.title} ${t.summary} ${t.content} ${t.tags.join(' ')}`
      },
      create: {
        ...t,
        searchDocument: `${t.title} ${t.summary} ${t.content} ${t.tags.join(' ')}`
      }
    });
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
