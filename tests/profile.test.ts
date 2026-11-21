import { afterEach, describe, expect, test, vi } from 'vitest';
import { loadProfile } from '../src/lib/profile';

afterEach(() => vi.unstubAllEnvs());

test('색을 안 적으면 기본 파랑', () => {
  const p = loadProfile('name: {ko: 홍길동, line1: GILDONG, line2: HONG, line3: "ROBOTICS × AI"}\nmonogram: GD.26\nintro: 안녕\nrepo: a/b');
  expect(p.theme.accent).toBe('#3b82f6');
  expect(p.fonts.ko.family).toBe('NanumSquareNeo');
  expect(p.links).toEqual([]);
});

test('개인 색이 기본값을 덮음', () => {
  const p = loadProfile('name: {ko: a, line1: A, line2: B, line3: C}\nmonogram: X\nintro: x\nrepo: a/b\ntheme: {accent: "#ff6a00", bg: "#ffffff"}');
  expect(p.theme.accent).toBe('#ff6a00');
  expect(p.theme.bg).toBe('#ffffff');
  expect(p.theme.fg).toBe('#f2f2f0');
});

describe('repo', () => {
  const base = 'name: {ko: a, line1: A, line2: B, line3: C}\nmonogram: X\nintro: x\n';
  test('없으면 GITHUB_REPOSITORY', () => {
    vi.stubEnv('GITHUB_REPOSITORY', 'env/repo');
    expect(loadProfile(base).repo).toBe('env/repo');
  });
  test('둘 다 없으면 안내와 함께 실패', () => {
    vi.stubEnv('GITHUB_REPOSITORY', '');
    expect(() => loadProfile(base)).toThrow('profile.yml에 repo: owner/name 를 적어 주세요');
  });
});

test('폰트 일부만 바꾸면 나머지는 기본값', () => {
  const p = loadProfile('name: {ko: a, line1: A, line2: B, line3: C}\nmonogram: X\nintro: x\nrepo: a/b\nfonts: {display: {family: Oswald, css: "https://fonts.googleapis.com/css2?family=Oswald"}}');
  expect(p.fonts.display.family).toBe('Oswald');
  expect(p.fonts.ko.boldFamily).toBe('NanumSquareNeoBold');
});

test('필수 값이 빠지면 어떤 값인지 알려 줌', () => {
  expect(() => loadProfile('monogram: X\nintro: x\nrepo: a/b')).toThrow(/name/);
});

test('저장소의 profile.yml을 읽음', () => {
  const p = loadProfile();
  expect(p.name.ko).toBeTruthy();
  expect(p.repo).toMatch(/^[^/]+\/[^/]+$/);
});

describe('interests', () => {
  const MIN_YAML = 'name: {ko: a, line1: A, line2: B, line3: C}\nmonogram: X\nintro: x\nrepo: a/b';
  test('profile interests 기본값', () => {
    expect(loadProfile(MIN_YAML).interests).toEqual([]);
  });
  test('적으면 문자열 배열로 읽음', () => {
    expect(loadProfile(MIN_YAML + '\ninterests: [DNA 손상 반응, 로봇 제어]').interests).toEqual(['DNA 손상 반응', '로봇 제어']);
  });
});
