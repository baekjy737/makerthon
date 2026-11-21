import { defineCollection } from 'astro:content';
import { glob, type Loader } from 'astro/loaders';
import { loadEnv } from 'vite';
import { firebaseWebConfig, firestoreLoader } from './lib/firestoreLoader';
import { applicationSchema, entrySchema, essaySchema, matchSchema, nextSchema, openingSchema } from './lib/schema';

export { applicationSchema, entrySchema, essaySchema, matchSchema, nextSchema, openingSchema };

// Firebase 웹 설정(PUBLIC_FIREBASE_*)이 있으면 Firestore에서, 없으면 content/ 폴더에서 읽는다.
const firebase = firebaseWebConfig({ ...loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), 'PUBLIC_'), ...process.env });
const source = (name: string, files: Loader): Loader => (firebase ? firestoreLoader(name, firebase) : files);

const entries = defineCollection({
  loader: source('entries', glob({ pattern: '**/*.md', base: './content/entries' })),
  schema: entrySchema,
});

const applications = defineCollection({
  // id = 폴더명 (content/applications/<slug>/index.md)
  loader: source('applications', glob({
    pattern: '*/index.md',
    base: './content/applications',
    generateId: ({ entry }) => entry.split('/')[0],
  })),
  schema: applicationSchema,
});

const essays = defineCollection({
  loader: source('essays', glob({ pattern: '*/essay-*.md', base: './content/applications' })),
  schema: essaySchema,
});

// id = 파일명에서 .md를 뺀 값
const next = defineCollection({
  loader: source('next', glob({ pattern: '*.md', base: './content/next' })),
  schema: nextSchema,
});

const matches = defineCollection({
  loader: source('matches', glob({ pattern: '*.md', base: './content/matches' })),
  schema: matchSchema,
});

const openings = defineCollection({
  loader: source('openings', glob({ pattern: '*.md', base: './content/openings' })),
  schema: openingSchema,
});

export const collections = { entries, applications, essays, next, matches, openings };
