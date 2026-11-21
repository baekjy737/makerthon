import { expect, test } from 'vitest';
import { groupByTopic, section } from '../src/lib/study';
import type { EntryType } from '../src/lib/types';

const t = (id: string, topics: string[], date = '2026-01-01', type: EntryType = 'course') => ({
  id,
  data: { type, date: new Date(date), public: true, featured: false, topics },
});

test('section은 다음 ## 전까지', () => {
  expect(section('## 배운 점\n복제 포크\n\n## 남은 질문\n왜?', '배운 점')).toBe('복제 포크');
  expect(section('본문', '남은 질문')).toBe('');
});

test('section: 마지막 섹션·CRLF·여러 줄', () => {
  expect(section('앞\r\n## 배운 점\r\n- 하나\r\n- 둘\r\n## 남은 질문\r\n왜?\r\n', '남은 질문')).toBe('왜?');
  expect(section('## 배운 점\n- 하나\n- 둘\n\n## 남은 질문\n', '배운 점')).toBe('- 하나\n- 둘');
});

test('section: 비슷한 제목은 무시', () => {
  expect(section('### 배운 점\nx', '배운 점')).toBe('');
  expect(section('## 배운 점들\nx', '배운 점')).toBe('');
});

test('section: ### 하위 제목은 섹션 안에 남음', () => {
  expect(section('## 배운 점\n### 1주차\n복제\n## 남은 질문\n왜?', '배운 점')).toBe('### 1주차\n복제');
});

test('groupByTopic: 기타는 맨 뒤', () => {
  expect(groupByTopic([t('a', []), t('b', ['생물'])]).map((g) => g.topic)).toEqual(['생물', '기타']);
});

// 한국어 정렬(localeCompare 'ko')이라 한글이 영문보다 앞에 온다
test('groupByTopic: 가나다순, topics[0] 기준, 그룹 안은 최신순', () => {
  const g = groupByTopic([
    t('old', ['로봇 제어'], '2025-01-01'),
    t('dna', ['DNA 손상 반응', '로봇 제어'], '2026-01-01'),
    t('new', ['로봇 제어'], '2026-05-01'),
    t('gita', [], '2026-02-01'),
    t('bio', ['가나 생물'], '2026-02-01'),
  ]);
  expect(g.map((x) => x.topic)).toEqual(['가나 생물', '로봇 제어', 'DNA 손상 반응', '기타']);
  expect(g[1].items.map((x) => x.id)).toEqual(['new', 'old']);
});

test('groupByTopic: 주제 이름이 "기타"여도 맨 뒤 한 그룹으로 합침', () => {
  const g = groupByTopic([t('a', ['기타']), t('b', []), t('c', ['생물'])]);
  expect(g.map((x) => x.topic)).toEqual(['생물', '기타']);
  expect(g[1].items).toHaveLength(2);
});
