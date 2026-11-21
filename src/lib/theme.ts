import type { Fonts, Theme } from './profile';

// <style> 안에 그대로 들어가므로 CSS를 깨거나 끼워 넣을 수 있는 문자는 막는다.
const SAFE_COLOR = /^[#a-zA-Z0-9(),.%\s\/+-]+$/;
const SAFE_FAMILY = /^[\p{L}\p{N} _-]+$/u;

function color(key: string, value: string): string {
  if (!SAFE_COLOR.test(value)) throw new Error(`profile.yml theme.${key} 색 값이 올바르지 않아요: ${value}`);
  return value.trim();
}

function family(key: string, value: string): string {
  if (!SAFE_FAMILY.test(value)) throw new Error(`profile.yml fonts.${key} 폰트 이름이 올바르지 않아요: ${value}`);
  return `"${value.trim()}"`;
}

export function themeCss(t: Theme): string {
  return `:root{--bg:${color('bg', t.bg)};--fg:${color('fg', t.fg)};--muted:${color('muted', t.muted)};--accent:${color('accent', t.accent)}}`;
}

export function fontCss(f: Fonts): string {
  const fallback = 'system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif';
  return (
    ':root{' +
    `--font-display:${family('display.family', f.display.family)},"Arial Narrow",Impact,sans-serif;` +
    `--font-ko:${family('ko.family', f.ko.family)},${fallback};` +
    `--font-ko-bold:${family('ko.boldFamily', f.ko.boldFamily)},${family('ko.family', f.ko.family)},${fallback}` +
    '}'
  );
}
