import { sortByDate, type EntryLike } from './entries';

export type StudySection = '배운 점' | '남은 질문';

/** 주제가 없는 공부 기록이 모이는 그룹 이름. 항상 맨 뒤에 둔다 */
export const NO_TOPIC = '기타';

/**
 * 본문에서 `## <heading>` 다음 줄부터 다음 `## ` 전까지를 돌려준다.
 * 제목이 정확히 같아야 하고(`### 배운 점`, `## 배운 점들`은 아님), 없으면 ''.
 */
export function section(body: string, heading: StudySection): string {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start === -1) return '';
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^##\s/.test(line));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
}

/**
 * topics[0]으로 묶는다. 주제가 없으면 '기타'.
 * 그룹은 가나다순(기타는 맨 뒤), 그룹 안은 최신순.
 */
export function groupByTopic<T extends EntryLike & { data: { topics: string[] } }>(xs: T[]): { topic: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const x of sortByDate(xs)) {
    const topic = x.data.topics[0]?.trim() || NO_TOPIC;
    const items = groups.get(topic) ?? [];
    items.push(x);
    groups.set(topic, items);
  }
  return [...groups]
    .map(([topic, items]) => ({ topic, items }))
    .sort((a, b) => {
      if (a.topic === NO_TOPIC) return 1;
      if (b.topic === NO_TOPIC) return -1;
      return a.topic.localeCompare(b.topic, 'ko');
    });
}
