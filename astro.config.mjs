// @ts-check
import fs from 'node:fs';
import vercel from '@astrojs/vercel';
import { AstroPWAIntegration } from '@vite-pwa/astro';
import { defineConfig } from 'astro/config';
import { parse as parseYaml } from 'yaml';

function normalizeBase(raw) {
  const trimmed = raw?.trim();
  if (!trimmed || trimmed === '/') return '/';
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

function readProfileForManifest() {
  const defaults = {
    nameKo: 'DGIST',
    monogram: 'GD.26',
    bg: '#0b0b0c',
  };

  if (!fs.existsSync('profile.yml')) return defaults;

  try {
    const parsed = parseYaml(fs.readFileSync('profile.yml', 'utf8')) ?? {};
    const nameKo =
      typeof parsed?.name?.ko === 'string' && parsed.name.ko.trim()
        ? parsed.name.ko.trim()
        : defaults.nameKo;
    const monogram =
      typeof parsed?.monogram === 'string' && parsed.monogram.trim()
        ? parsed.monogram.trim()
        : defaults.monogram;
    const bg =
      typeof parsed?.theme?.bg === 'string' && parsed.theme.bg.trim()
        ? parsed.theme.bg.trim()
        : defaults.bg;
    return { nameKo, monogram, bg };
  } catch {
    return defaults;
  }
}

// 서버 경로(/api)가 있으면 정적 파일은 dist/client로 나가는데, PWA는 sw.js·workbox를 dist/에 만들고
// Vercel 어댑터는 그보다 먼저 dist/client를 .vercel/output/static으로 복사한다. 그래서 두 곳에 따라 복사한다
const copyServiceWorker = {
  name: 'copy-service-worker-to-vercel',
  hooks: {
    'astro:build:done': () => {
      const from = 'dist';
      if (!fs.existsSync('dist/client')) return;
      for (const name of fs.readdirSync(from)) {
        if (!/^(sw\.js|workbox-[\w-]+\.js)(\.map)?$/.test(name)) continue;
        for (const to of ['dist/client', '.vercel/output/static']) {
          if (fs.existsSync(to)) fs.copyFileSync(`${from}/${name}`, `${to}/${name}`);
        }
      }
    },
  },
};

const base = normalizeBase(process.env.BASE_PATH);
const escapedBaseNoSlash = base.slice(0, -1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pagePattern =
  base === '/'
    ? /^https?:\/\/[^/]+(?:\/[^?#]*)?(?:\?.*)?$/
    : new RegExp(`^https?://[^/]+${escapedBaseNoSlash}(?:/[^?#]*)?(?:\\?.*)?$`);
const site = process.env.SITE_URL?.trim() || undefined;
const profile = readProfileForManifest();

// https://astro.build/config
export default defineConfig({
  base,
  // 페이지는 정적 빌드, /api/*만 Vercel 함수(prerender = false)
  adapter: vercel({
    // AI 파이프라인이 작업 폴더를 만들 때 읽는 파일
    includeFiles: [
      'CLAUDE.md',
      ...['archive', 'essay', 'job-analysis', 'opening', 'recommend'].map((s) => `.claude/skills/${s}/SKILL.md`),
      'data/labs.json', 'data/interns.json', 'data/courses.json', 'data/research-internships.json'],
    maxDuration: 300,
  }),
  ...(site ? { site } : {}),
  integrations: [
    AstroPWAIntegration({
      registerType: 'autoUpdate',
      manifest: {
        name: '아카이빙 프로젝트',
        short_name: profile.monogram,
        lang: 'ko',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: profile.bg,
        theme_color: profile.bg,
        icons: [
          {
            src: `${base}icons/icon-192.png`,
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: `${base}icons/icon-512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      generateSW: {
        navigateFallback: null,
        globPatterns: [],
        runtimeCaching: [
          {
            urlPattern: /\.(?:css|js|mjs|png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|pdf|webmanifest)(?:\?.*)?$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'visited-assets',
            },
          },
          {
            urlPattern: pagePattern,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'visited-pages',
            },
          },
        ],
      },
    }),
    copyServiceWorker,
  ],
});
