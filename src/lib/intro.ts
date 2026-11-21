const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/**
 * profile.yml의 intro를 HTML로. 먼저 전부 이스케이프하고, `**구절**`만 <strong>으로 바꾼다.
 * 짝이 안 맞는 `**`는 글자 그대로 남는다.
 */
export function introHtml(intro: string): string {
  const escaped = intro.replace(/[&<>"']/g, (c) => ESCAPES[c]);
  return escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}
