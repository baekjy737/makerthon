// 스키마는 astro:content 없이 import할 수 있도록 여기 둔다(Vitest용).
// src/content.config.ts가 이 파일을 import해 collection을 만든다.
import { z } from 'astro/zod';
import { ENTRY_TYPES } from './types';

export const entrySchema = z.object({
  type: z.enum(ENTRY_TYPES),
  title: z.string(),
  date: z.coerce.date(),
  end: z.coerce.date().optional(),
  org: z.string().optional(),
  role: z.string().optional(),
  /** 이력서 한 줄 요약 */
  summary: z.string().max(80),
  tags: z.array(z.string()).default([]),
  metrics: z.array(z.string()).default([]),
  featured: z.boolean().default(false),
  public: z.boolean().default(true),
  links: z.array(z.object({ label: z.string(), url: z.string().url() })).default([]),
  /** public/ 기준 경로 */
  attachments: z.array(z.string()).default([]),
});

export const applicationSchema = z.object({
  company: z.string(),
  position: z.string(),
  url: z.string().optional(),
  deadline: z.coerce.date().optional(),
  created: z.coerce.date(),
  requirements: z.array(z.string()),
  matches: z.array(
    z.object({
      /** entries collection id */
      entry: z.string(),
      score: z.number().min(0).max(100),
      reason: z.string(),
    }),
  ),
  gaps: z.array(z.string()),
});

export const essaySchema = z.object({
  question: z.string(),
  limit: z.number().optional(),
  entries: z.array(z.string()).default([]),
});

export type EntryData = z.infer<typeof entrySchema>;
export type ApplicationData = z.infer<typeof applicationSchema>;
export type EssayData = z.infer<typeof essaySchema>;
