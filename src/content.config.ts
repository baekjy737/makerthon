import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { applicationSchema, entrySchema, essaySchema } from './lib/schema';

export { applicationSchema, entrySchema, essaySchema };

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

export const collections = { entries, applications, essays };
