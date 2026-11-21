import { expect, test } from 'vitest';
import { fontCss, themeCss } from '../src/lib/theme';
import { withBase } from '../src/lib/url';

test('CSS 변수 생성', () => {
  expect(themeCss({ bg: '#000', fg: '#fff', muted: '#888', accent: '#3b82f6' })).toBe(':root{--bg:#000;--fg:#fff;--muted:#888;--accent:#3b82f6}');
});

test('색 값에 ; 나 } 가 있으면 거부', () => {
  expect(() => themeCss({ bg: '#000;}body{display:none', fg: '#fff', muted: '#888', accent: '#00f' })).toThrow();
});

test('rgb()·이름 색 허용', () => {
  expect(themeCss({ bg: 'rgb(11 11 12)', fg: 'white', muted: 'rgba(255,255,255,0.5)', accent: '#00f' })).toContain('--bg:rgb(11 11 12)');
});

test('폰트 변수 생성, 이상한 이름 거부', () => {
  const f = {
    display: { family: 'Anton', css: 'x' },
    ko: { family: 'NanumSquareNeo', boldFamily: 'NanumSquareNeoBold', css: 'y' },
  };
  expect(fontCss(f)).toContain('--font-display:"Anton"');
  expect(fontCss(f)).toContain('--font-ko-bold:"NanumSquareNeoBold"');
  expect(() => fontCss({ ...f, display: { family: 'A";}*{x:"', css: 'x' } })).toThrow();
});

test('withBase는 슬래시 하나로 합침', () => {
  expect(withBase('/archive', '/makerthon/')).toBe('/makerthon/archive');
  expect(withBase('archive', '/makerthon')).toBe('/makerthon/archive');
  expect(withBase('/', '/makerthon/')).toBe('/makerthon/');
  expect(withBase('/resume', '/')).toBe('/resume');
  expect(withBase('/manage')).toBe('/manage');
  expect(withBase('https://example.com/a', '/x/')).toBe('https://example.com/a');
});
