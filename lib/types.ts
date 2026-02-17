import { z } from 'zod';

export const createTemplateSchema = z.object({
  title: z.string().min(3).max(120),
  summary: z.string().min(10).max(300),
  content: z.string().min(10),
  type: z.enum(['CODE', 'IDEA', 'STORY', 'OTHER']),
  tags: z.array(z.string().min(1).max(30)).max(12),
  ownerId: z.string().min(3),
  featured: z.boolean().optional()
});

export const contributionSchema = z.object({
  templateId: z.string().min(3),
  userId: z.string().min(3),
  message: z.string().min(4).max(300)
});
