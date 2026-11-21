import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..');
// 서버 경로(/api)가 있어 정적 파일은 dist/client로 나간다(Vercel 어댑터)
const DIST = path.join(ROOT, 'dist', 'client');
// Vitest가 process.env에 넣는 BASE_URL=/ 가 빌드의 import.meta.env.BASE_URL을 덮으므로 빼고 넘긴다.
const { BASE_URL, MODE, DEV, PROD, SSR, ...BUILD_ENV } = process.env;

function collectHtmlFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectHtmlFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      results.push(full);
    }
  }
  return results;
}

function readPngDimensions(filePath: string): { width: number; height: number } {
  const buf = fs.readFileSync(filePath);
  const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  expect(buf.subarray(0, 8).equals(pngSig)).toBe(true);
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}

function findNonPrefixedRootRefs(html: string, base: string): string[] {
  const bad: string[] = [];
  const pattern = /\b(?:href|src)=["'](\/(?!\/)[^"']*)["']/g;
  for (const match of html.matchAll(pattern)) {
    const value = match[1];
    if (!value.startsWith(base)) {
      bad.push(`${match[0]}`);
    }
  }
  return bad;
}

describe('PWA 아이콘 에셋', () => {
  test('192x192, 512x512 PNG 아이콘 존재', () => {
    expect(readPngDimensions(path.join(ROOT, 'public/icons/icon-192.png'))).toEqual({
      width: 192,
      height: 192,
    });
    expect(readPngDimensions(path.join(ROOT, 'public/icons/icon-512.png'))).toEqual({
      width: 512,
      height: 512,
    });
  });

  test('루트 상대 경로 검사기가 base 없는 href/src만 잡아냄', () => {
    const sample = [
      '<a href="/other/archive">ok</a>',
      '<a href="/archive">bad</a>',
      '<img src="/icons/a.png">',
      '<img src="/other/icons/a.png">',
      '<a href="https://example.com/a">ext</a>',
      '<script src="//cdn.example.com/a.js"></script>',
    ].join('');
    expect(findNonPrefixedRootRefs(sample, '/other/')).toEqual([
      'href="/archive"',
      'src="/icons/a.png"',
    ]);
  });
});

describe('BASE_PATH 빌드 검증', () => {
  test.skipIf(!process.env.FULL)(
    'BASE_PATH=/other/ 빌드 시 모든 루트 링크·에셋·manifest가 /other/로 시작',
    () => {
      execSync('npm run build', {
        cwd: ROOT,
        env: { ...BUILD_ENV, BASE_PATH: '/other/' },
        stdio: 'pipe',
      });

      const htmlFiles = collectHtmlFiles(DIST);
      const violations: string[] = [];
      for (const file of htmlFiles) {
        const html = fs.readFileSync(file, 'utf8');
        const bad = findNonPrefixedRootRefs(html, '/other/');
        if (bad.length > 0) {
          violations.push(`${path.relative(DIST, file)}: ${bad.join(', ')}`);
        }
      }
      expect(violations).toEqual([]);

      const manifestPath = path.join(DIST, 'manifest.webmanifest');
      expect(fs.existsSync(manifestPath)).toBe(true);
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      expect(manifest.start_url).toBe('/other/');
      expect(manifest.scope).toBe('/other/');
      expect(manifest.display).toBe('standalone');
      expect(Array.isArray(manifest.icons)).toBe(true);
      expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
      for (const icon of manifest.icons) {
        expect(icon.src.startsWith('/other/')).toBe(true);
        const relIcon = icon.src.slice('/other/'.length);
        expect(fs.existsSync(path.join(DIST, relIcon))).toBe(true);
      }

      const swPath = path.join(DIST, 'sw.js');
      expect(fs.existsSync(swPath)).toBe(true);
      const sw = fs.readFileSync(swPath, 'utf8');
      expect(sw).not.toContain('createHandlerBoundToURL');

      const registerSwPath = path.join(DIST, 'registerSW.js');
      expect(fs.existsSync(registerSwPath)).toBe(true);
      const registerSw = fs.readFileSync(registerSwPath, 'utf8');
      expect(registerSw).toContain('/other/sw.js');
      expect(registerSw).toContain('/other/');
    },
    30_000,
  );

  test.skipIf(!process.env.FULL)(
    '끝 슬래시가 없는 BASE_PATH=/other 빌드도 /other/로 정규화',
    () => {
      execSync('npm run build', {
        cwd: ROOT,
        env: { ...BUILD_ENV, BASE_PATH: '/other' },
        stdio: 'pipe',
      });

      const manifest = JSON.parse(
        fs.readFileSync(path.join(DIST, 'manifest.webmanifest'), 'utf8'),
      );
      expect(manifest.start_url).toBe('/other/');
      expect(manifest.scope).toBe('/other/');
      for (const icon of manifest.icons) {
        expect(icon.src.startsWith('/other/')).toBe(true);
      }
    },
    30_000,
  );
});
