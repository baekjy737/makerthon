// @ts-check
import fs from 'node:fs';
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
  ...(site ? { site } : {}),
  integrations: [
    AstroPWAIntegration({
      registerType: 'autoUpdate',
      manifest: {
        name: `${profile.nameKo} 아카이브`,
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
  ],
});
