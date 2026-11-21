export const ENTRY_TYPES = [
  'project',
  'research',
  'award',
  'activity',
  'career',
  'education',
  'certificate',
  'etc',
  'course',
  'paper',
  'study',
] as const;

export type EntryType = (typeof ENTRY_TYPES)[number];

/** 공부 기록 종류. 이력서(TYPE_ORDER)에는 들어가지 않는다. */
export const STUDY_TYPES = ['course', 'paper', 'study'] as const;

export type StudyType = (typeof STUDY_TYPES)[number];

/** 이력서 섹션 순서. 공부 기록(STUDY_TYPES)은 일부러 넣지 않는다. */
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
  course: '수강 과목',
  paper: '읽은 논문',
  study: '공부자료',
};
