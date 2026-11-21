import { expect, test } from 'vitest';
import { introHtml } from '../src/lib/intro';

test('**구절**만 strong으로', () => {
  expect(introHtml('DGIST에서 **로봇과 AI**를 공부하며 **기록**합니다.')).toBe(
    'DGIST에서 <strong>로봇과 AI</strong>를 공부하며 <strong>기록</strong>합니다.',
  );
});

test('HTML은 이스케이프 (굵게 안쪽 포함)', () => {
  expect(introHtml('<img src=x onerror=alert(1)> **<b>"a"</b>**')).toBe(
    '&lt;img src=x onerror=alert(1)&gt; <strong>&lt;b&gt;&quot;a&quot;&lt;/b&gt;</strong>',
  );
});

test('짝 없는 ** 는 그대로', () => {
  expect(introHtml('2**3 은 8')).toBe('2**3 은 8');
});
