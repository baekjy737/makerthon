import { expect, test } from 'vitest';
import { issueUrl, MAX_ISSUE_URL } from '../src/lib/issue';

test('라벨·제목·본문 인코딩', () => {
  const u = new URL(issueUrl('a/b', { label: 'memo', title: '[메모] 해커톤', body: '팀장 함' }));
  expect(u.origin).toBe('https://github.com');
  expect(u.pathname).toBe('/a/b/issues/new');
  expect(u.searchParams.get('labels')).toBe('memo');
  expect(u.searchParams.get('title')).toBe('[메모] 해커톤');
  expect(u.searchParams.get('body')).toBe('팀장 함');
});

test('특수문자(&·#·+·줄바꿈)가 깨지지 않음', () => {
  const body = 'A&B #1 + C\n\n100% 완료?';
  const u = new URL(issueUrl('a/b', { label: 'archive', title: 'x', body }));
  expect(u.searchParams.get('body')).toBe(body);
});

test('짧은 본문은 자르지 않음', () => {
  const u = new URL(issueUrl('a/b', { label: 'memo', title: 't', body: '짧은 메모' }));
  expect(u.searchParams.get('body')).not.toContain('잘렸어요');
});

test('긴 본문은 8000자 안으로 자르고 안내', () => {
  const u = issueUrl('a/b', { label: 'memo', title: 't', body: '가'.repeat(20000) });
  expect(u.length).toBeLessThanOrEqual(MAX_ISSUE_URL);
  const body = new URL(u).searchParams.get('body')!;
  expect(body).toContain('잘렸어요');
  expect(body.startsWith('가')).toBe(true);
});

test('자를 때 이모지(서로게이트 쌍)를 반으로 쪼개지 않음', () => {
  const u = issueUrl('a/b', { label: 'memo', title: 't', body: '😀'.repeat(5000) });
  expect(u.length).toBeLessThanOrEqual(MAX_ISSUE_URL);
  expect(() => decodeURIComponent(new URL(u).search)).not.toThrow();
  expect(new URL(u).searchParams.get('body')).not.toContain('�');
});

test('경계: 딱 맞는 길이는 남기고 한 글자 넘치면 자름', () => {
  const base = issueUrl('a/b', { label: 'memo', title: 't', body: '' }).length;
  const fit = 'a'.repeat(MAX_ISSUE_URL - base);
  expect(issueUrl('a/b', { label: 'memo', title: 't', body: fit }).length).toBe(MAX_ISSUE_URL);
  expect(new URL(issueUrl('a/b', { label: 'memo', title: 't', body: fit })).searchParams.get('body')).toBe(fit);
  const over = issueUrl('a/b', { label: 'memo', title: 't', body: fit + 'a' });
  expect(over.length).toBeLessThanOrEqual(MAX_ISSUE_URL);
  expect(new URL(over).searchParams.get('body')).toContain('잘렸어요');
});
