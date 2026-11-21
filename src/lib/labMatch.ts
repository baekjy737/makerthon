import type { Lab } from './data';
import type { ResearchTopic } from './openings';

export type LabMatch = { lab: Lab; hits: string[] };
export type TopicMatch = { topic: ResearchTopic; hits: string[] };
type Interest = { label: string; normalized: string };

/** 대소문자와 공백 차이 없이 검색할 수 있는 비교용 문자열 */
export function normalizeInterest(value: string): string {
  return value.toLocaleLowerCase().replace(/\s+/gu, '');
}

function uniqueInterests(interests: string[]): Interest[] {
  return interests.reduce<Interest[]>((all, interest) => {
    const label = interest.trim();
    const normalized = normalizeInterest(label);
    if (!normalized || all.some((item) => item.normalized === normalized)) return all;
    all.push({ label, normalized });
    return all;
  }, []);
}

function matchingInterests(fields: Array<string | undefined | null>, interests: Interest[]): string[] {
  const normalizedFields = fields
    .filter((field): field is string => typeof field === 'string')
    .map(normalizeInterest);
  return interests
    .filter((interest) => normalizedFields.some((field) => field.includes(interest.normalized)))
    .map((interest) => interest.label);
}

/**
 * 프로필 관심사를 연구실의 학과·요약·인턴 주제와 맞춘다.
 * 관심사가 있으면 하나 이상 맞는 연구실만, 많이 맞은 순서로 돌려준다.
 * 관심사가 비어 있으면 탐색을 막지 않고 전체 연구실을 원래 순서로 돌려준다.
 */
export function matchLabs(labs: Lab[], interests: string[]): LabMatch[] {
  const unique = uniqueInterests(interests);

  if (unique.length === 0) {
    return labs.map((lab) => ({ lab, hits: [] }));
  }

  return labs
    .map((lab, index) => {
      const hits = matchingInterests([lab.dept, lab.summary, ...lab.internTopics], unique);
      return { lab, hits, index };
    })
    .filter((item) => item.hits.length > 0)
    .sort((a, b) => b.hits.length - a.hits.length || a.index - b.index)
    .map(({ lab, hits }) => ({ lab, hits }));
}

/**
 * 타 기관 연구인턴 주제를 분야·연구실·학과와 함께 관심사에 맞춘다.
 * matchLabs와 같은 정렬·빈 관심사 규칙을 쓴다.
 */
export function matchTopics(topics: ResearchTopic[], interests: string[]): TopicMatch[] {
  const unique = uniqueInterests(interests);

  if (unique.length === 0) {
    return topics.map((topic) => ({ topic, hits: [] }));
  }

  return topics
    .map((topic, index) => ({
      topic,
      hits: matchingInterests([topic.topic, topic.category, topic.lab, topic.division], unique),
      index,
    }))
    .filter((item) => item.hits.length > 0)
    .sort((a, b) => b.hits.length - a.hits.length || a.index - b.index)
    .map(({ topic, hits }) => ({ topic, hits }));
}
