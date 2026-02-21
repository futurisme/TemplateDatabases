import { z } from 'zod';

export const createTemplateSchema = z.object({
  title: z.string().min(3).max(120),
  summary: z.string().min(10).max(300),
  content: z.string().min(10),
  type: z.enum(['CODE', 'IDEA', 'STORY', 'OTHER']),
  tags: z.array(z.string().min(1).max(30)).max(12),
  ownerRef: z.string().min(1),
  featured: z.boolean().optional()
});

export const contributionSchema = z.object({
  templateRef: z.string().min(3),
  contributorRef: z.string().min(2).max(64),
  message: z.string().min(4).max(300)
});
