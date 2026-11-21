// 스키마는 astro:content 없이 import할 수 있도록 여기 둔다(Vitest용).
// src/content.config.ts가 이 파일을 import해 collection을 만든다.
import { z } from 'astro/zod';
import { ENTRY_TYPES, OPENING_KINDS } from './types.ts';

export const entrySchema = z.object({
  type: z.enum(ENTRY_TYPES),
  title: z.string(),
  date: z.coerce.date(),
  end: z.coerce.date().optional(),
  org: z.string().optional(),
  role: z.string().optional(),
  /** 이력서 한 줄 요약 */
  summary: z.string().max(80),
  tags: z.array(z.string()).default([]),
  metrics: z.array(z.string()).default([]),
  featured: z.boolean().default(false),
  public: z.boolean().default(true),
  links: z.array(z.object({ label: z.string(), url: z.string().url() })).default([]),
  /** public/ 기준 경로 */
  attachments: z.array(z.string()).default([]),
  /** 공부 기록 주제. 메인 탭은 topics[0]으로 묶는다 */
  topics: z.array(z.string()).default([]),
  /** 수강 과목 번호 (data/courses.json의 code, 예 BS116) */
  course_code: z.string().optional(),
});

export const applicationSchema = z.object({
  company: z.string(),
  position: z.string(),
  url: z.string().optional(),
  deadline: z.coerce.date().optional(),
  created: z.coerce.date(),
  requirements: z.array(z.string()),
  matches: z.array(
    z.object({
      /** entries collection id */
      entry: z.string(),
      score: z.number().min(0).max(100),
      reason: z.string(),
    }),
  ),
  gaps: z.array(z.string()),
});

export const essaySchema = z.object({
  question: z.string(),
  limit: z.number().optional(),
  entries: z.array(z.string()).default([]),
  /** 문항별 추천 소재. entry = 항목 id, draft = 그 소재로 쓴 초안(글자 수 제한 안) */
  materials: z.array(z.object({ entry: z.string(), reason: z.string(), draft: z.string() })).default([]),
  /** 기록에 없어 작성자에게 확인할 개인 기여·성과 */
  checks: z.array(z.string()).default([]),
});

/** 다음 공부 추천 (content/next/<slug>.md) */
export const nextSchema = z.object({
  topic: z.string(),
  created: z.coerce.date(),
  /** 근거가 된 공개 항목 id. 1개 이상 */
  from: z.array(z.string()).min(1),
  /** 이미 공부한 내용 */
  learned: z.array(z.string()),
  /** 다음에 공부할 개념. 1개 이상 */
  next: z.array(z.string()).min(1),
  /** 이어서 볼 자료(url)나 과목(course: data/courses.json 과목명) */
  resources: z
    .array(z.object({ label: z.string(), url: z.string().url().optional(), course: z.string().optional() }))
    .default([]),
  /** 탐구할 연구 질문 */
  questions: z.array(z.string()).default([]),
  /** 바로 해볼 공부·탐구. 구체적인 행동 하나씩 */
  actions: z.array(z.string()).default([]),
});

export const MATCH_KINDS = ['lab', 'company', 'intern'] as const;

/** 연구실·기업·인턴 기회 카드 (content/matches/<slug>.md) */
export const matchSchema = z.object({
  kind: z.enum(MATCH_KINDS),
  /** lab: Lab.id, intern: Intern.id, company: 회사 이름 (data/*.json) */
  target: z.string(),
  created: z.coerce.date(),
  score: z.number().min(0).max(100),
  reason: z.string(),
  /** 근거가 된 공개 항목 id. 1개 이상 */
  from: z.array(z.string()).min(1),
  /** 지원 전 더 알아볼 점 */
  check: z.array(z.string()).default([]),
  sources: z.array(z.object({ label: z.string(), url: z.string().url() })).default([]),
});

/** 모집 공고 (content/openings/<slug>.md). 본문은 공고 요약 */
export const openingSchema = z.object({
  kind: z.enum(OPENING_KINDS),
  /** 기관·회사 */
  org: z.string(),
  title: z.string(),
  /** 원본 공고 */
  url: z.string().url(),
  /** 원문에서 접수 기간을 확인했을 때만 true. false면 기간 안이어도 '모집 중'이 되지 않는다 */
  verified: z.boolean().default(false),
  /** 모집 대상 */
  target: z.string().optional(),
  /** 자격 요건 */
  eligibility: z.string().optional(),
  start: z.coerce.date().optional(),
  deadline: z.coerce.date().optional(),
  tags: z.array(z.string()).default([]),
  /** data/labs.json의 연구실 id */
  lab: z.string().optional(),
  created: z.coerce.date(),
});

export type EntryData = z.infer<typeof entrySchema>;
export type ApplicationData = z.infer<typeof applicationSchema>;
export type EssayData = z.infer<typeof essaySchema>;
export type NextData = z.infer<typeof nextSchema>;
export type MatchData = z.infer<typeof matchSchema>;
export type MatchKind = (typeof MATCH_KINDS)[number];
export type OpeningData = z.infer<typeof openingSchema>;
