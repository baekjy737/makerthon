export type IssueLabel = 'archive' | 'job' | 'essay' | 'memo' | 'recommend' | 'opening';

export interface IssueOptions {
  label: IssueLabel;
  title: string;
  body: string;
}

/** 브라우저·GitHub가 안정적으로 받는 이슈 작성 URL 최대 길이 */
export const MAX_ISSUE_URL = 8000;

export const TRUNCATED_NOTE = '\n\n(메모가 길어서 잘렸어요. 나머지는 이 아래에 붙여 넣어 주세요.)';

function build(repo: string, o: IssueOptions, body: string): string {
  const q = [
    `labels=${encodeURIComponent(o.label)}`,
    `title=${encodeURIComponent(o.title)}`,
    `body=${encodeURIComponent(body)}`,
  ].join('&');
  return `https://github.com/${repo}/issues/new?${q}`;
}

/**
 * 미리 채운 GitHub 이슈 작성 URL.
 * 전체 길이가 MAX_ISSUE_URL을 넘으면 body를 잘라 끝에 안내를 붙인다.
 * 한글 등은 인코딩하면 글자당 9자가 되므로 글자 수가 아니라 인코딩된 길이로 맞춘다.
 */
export function issueUrl(repo: string, o: IssueOptions): string {
  const full = build(repo, o, o.body);
  if (full.length <= MAX_ISSUE_URL) return full;

  // 코드 포인트 단위로 잘라 이모지 같은 서로게이트 쌍을 쪼개지 않는다.
  const chars = Array.from(o.body);
  const fits = (n: number) => build(repo, o, chars.slice(0, n).join('') + TRUNCATED_NOTE).length <= MAX_ISSUE_URL;

  // fits(n)을 만족하는 가장 큰 n을 이분 탐색
  let lo = 0;
  let hi = chars.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (fits(mid)) lo = mid;
    else hi = mid - 1;
  }
  return build(repo, o, chars.slice(0, lo).join('') + TRUNCATED_NOTE);
}
