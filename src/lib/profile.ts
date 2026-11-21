import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';

export interface Theme {
  bg: string;
  fg: string;
  muted: string;
  accent: string;
}

export interface Fonts {
  display: { family: string; css: string };
  ko: { family: string; boldFamily: string; css: string };
}

export interface Profile {
  name: { ko: string; line1: string; line2: string; line3: string };
  monogram: string;
  /** **굵게** 허용 */
  intro: string;
  photo?: string;
  email?: string;
  links: { label: string; url: string }[];
  /** 관심 분야. 추천(recommend 스킬)이 다음 공부와 기회를 고를 때 쓴다 */
  interests: string[];
  /** owner/name */
  repo: string;
  theme: Theme;
  fonts: Fonts;
}

export const DEFAULT_THEME: Theme = {
  bg: '#0b0b0c',
  fg: '#f2f2f0',
  muted: '#8a8a8f',
  accent: '#3b82f6',
};

export const DEFAULT_FONTS: Fonts = {
  display: {
    family: 'Anton',
    css: 'https://fonts.googleapis.com/css2?family=Anton&display=swap',
  },
  ko: {
    family: 'NanumSquareNeo',
    boldFamily: 'NanumSquareNeoBold',
    css: 'https://hangeul.pstatic.net/hangeul_static/css/nanum-square-neo.css',
  },
};

type Raw = Record<string, any>;

function need(value: unknown, field: string): string {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error(`profile.yml에 ${field} 를 적어 주세요`);
  }
  return String(value);
}

function optional(value: unknown): string | undefined {
  return value === undefined || value === null || value === '' ? undefined : String(value);
}

/** profile.yml을 읽어 빠진 값은 기본값으로 채운다. raw를 주면 파일 대신 그 문자열을 읽는다. */
export function loadProfile(raw?: string): Profile {
  const text = raw ?? readFileSync(resolve(process.cwd(), 'profile.yml'), 'utf8');
  const y: Raw = parse(text) ?? {};

  const name: Raw = y.name ?? {};
  const repo = optional(y.repo) ?? optional(process.env.GITHUB_REPOSITORY);
  if (!repo) throw new Error('profile.yml에 repo: owner/name 를 적어 주세요');

  const theme: Raw = y.theme ?? {};
  const fonts: Raw = y.fonts ?? {};

  return {
    name: {
      ko: need(name.ko, 'name.ko'),
      line1: need(name.line1, 'name.line1'),
      line2: need(name.line2, 'name.line2'),
      line3: need(name.line3, 'name.line3'),
    },
    monogram: need(y.monogram, 'monogram'),
    intro: need(y.intro, 'intro'),
    photo: optional(y.photo),
    email: optional(y.email),
    links: Array.isArray(y.links)
      ? y.links.map((l: Raw, i: number) => ({ label: need(l?.label, `links[${i}].label`), url: need(l?.url, `links[${i}].url`) }))
      : [],
    interests: Array.isArray(y.interests) ? y.interests.map(optional).filter((x: string | undefined): x is string => !!x) : [],
    repo,
    theme: {
      bg: optional(theme.bg) ?? DEFAULT_THEME.bg,
      fg: optional(theme.fg) ?? DEFAULT_THEME.fg,
      muted: optional(theme.muted) ?? DEFAULT_THEME.muted,
      accent: optional(theme.accent) ?? DEFAULT_THEME.accent,
    },
    fonts: {
      display: { ...DEFAULT_FONTS.display, ...clean(fonts.display) },
      ko: { ...DEFAULT_FONTS.ko, ...clean(fonts.ko) },
    },
  };
}

/** 빈 값은 빼서 기본값을 덮지 않게 한다. */
function clean(o: unknown): Record<string, string> {
  if (!o || typeof o !== 'object') return {};
  return Object.fromEntries(
    Object.entries(o as Raw)
      .map(([k, v]) => [k, optional(v)])
      .filter(([, v]) => v !== undefined),
  ) as Record<string, string>;
}
