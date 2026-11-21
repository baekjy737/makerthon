import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { applicationSchema, entrySchema, essaySchema, matchSchema, nextSchema, openingSchema } from './lib/schema';

export { applicationSchema, entrySchema, essaySchema, matchSchema, nextSchema, openingSchema };

const entries = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/entries' }),
  schema: entrySchema,
});

const applications = defineCollection({
  // id = 폴더명 (content/applications/<slug>/index.md)
  loader: glob({
    pattern: '*/index.md',
    base: './content/applications',
    generateId: ({ entry }) => entry.split('/')[0],
  }),
  schema: applicationSchema,
});

const essays = defineCollection({
  loader: glob({ pattern: '*/essay-*.md', base: './content/applications' }),
  schema: essaySchema,
});

// id = 파일명에서 .md를 뺀 값
const next = defineCollection({
  loader: glob({ pattern: '*.md', base: './content/next' }),
  schema: nextSchema,
});

const matches = defineCollection({
  loader: glob({ pattern: '*.md', base: './content/matches' }),
  schema: matchSchema,
});

const openings = defineCollection({
  loader: glob({ pattern: '*.md', base: './content/openings' }),
  schema: openingSchema,
});

export const collections = { entries, applications, essays, next, matches, openings };
