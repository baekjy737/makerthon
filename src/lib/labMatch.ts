import type { Lab } from './data';

export type LabMatch = { lab: Lab; hits: string[] };

/** 대소문자와 공백 차이 없이 검색할 수 있는 비교용 문자열 */
export function normalizeInterest(value: string): string {
  return value.toLocaleLowerCase().replace(/\s+/gu, '');
}

/**
 * 프로필 관심사를 연구실의 학과·요약·인턴 주제와 맞춘다.
 * 관심사가 있으면 하나 이상 맞는 연구실만, 많이 맞은 순서로 돌려준다.
 * 관심사가 비어 있으면 탐색을 막지 않고 전체 연구실을 원래 순서로 돌려준다.
 */
export function matchLabs(labs: Lab[], interests: string[]): LabMatch[] {
  const uniqueInterests = interests.reduce<{ label: string; normalized: string }[]>((all, interest) => {
    const label = interest.trim();
    const normalized = normalizeInterest(label);
    if (!normalized || all.some((item) => item.normalized === normalized)) return all;
    all.push({ label, normalized });
    return all;
  }, []);

  if (uniqueInterests.length === 0) {
    return labs.map((lab) => ({ lab, hits: [] }));
  }

  return labs
    .map((lab, index) => {
      const fields = [lab.dept, lab.summary, ...lab.internTopics].map(normalizeInterest);
      const hits = uniqueInterests
        .filter((interest) => fields.some((field) => field.includes(interest.normalized)))
        .map((interest) => interest.label);
      return { lab, hits, index };
    })
    .filter((item) => item.hits.length > 0)
    .sort((a, b) => b.hits.length - a.hits.length || a.index - b.index)
    .map(({ lab, hits }) => ({ lab, hits }));
}
