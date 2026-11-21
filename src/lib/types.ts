export const ENTRY_TYPES = ['project', 'research', 'award', 'activity', 'career', 'education', 'certificate', 'etc'] as const;

export type EntryType = (typeof ENTRY_TYPES)[number];

/** 이력서 섹션 순서 */
export const TYPE_ORDER: EntryType[] = ['education', 'career', 'project', 'research', 'award', 'activity', 'certificate', 'etc'];

export const TYPE_LABELS: Record<EntryType, string> = {
  project: '프로젝트',
  research: '연구/논문',
  award: '수상',
  activity: '대외활동/동아리',
  career: '경력/인턴',
  education: '학력',
  certificate: '자격/어학',
  etc: '기타',
};
