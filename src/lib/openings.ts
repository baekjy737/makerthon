import researchJson from '../../data/research-internships.json';
import type { Intern } from './data';
import { seoulDay } from './recommend';
import type { OpeningData } from './schema';
import { OPENING_KINDS, type OpeningKind } from './types';

export { OPENING_KINDS, type OpeningKind };

export const OPENING_LABELS: Record<OpeningKind, string> = {
  'lab-intern': '대학원 연구실 인턴',
  'undergrad-research': '연구과제 학부연구생',
  'company-intern': '기업 인턴',
  'company-job': '기업 채용',
};

/** content/openings와 data/interns.json을 합친 공고 한 건 */
export type Opening = {
  id: string;
  kind: OpeningKind;
  org: string;
  title: string;
  /** 원본 공고. 데이터에 없으면 '' */
  url: string;
  verified: boolean;
  /** 모집 대상 */
  target?: string;
  /** 자격 요건 */
  eligibility?: string;
  start?: Date;
  deadline?: Date;
  /** 마감일을 날짜로 알 수 없을 때 원문 표기(예: "상시 문의", "2026 동계") */
  deadlineText?: string;
  tags: string[];
  /** data/labs.json의 연구실 id */
  lab?: string;
};

/** data/research-internships.json의 programs 한 건(대학원·출연연 연구 인턴). 필드 그대로 */
export type ResearchProgram = {
  id: string;
  /** 대학원, 연구기관 등 */
  orgType: string;
  org: string;
  program: string;
  /** "기계·재료·로봇"처럼 가운뎃점으로 나열 */
  field: string;
  /** 타교 지원 가능 여부(가능, 불가(학부), 학교제한 …) */
  crossSchool: string;
  eligibility: string;
  /** YYYY-MM 또는 YYYY-MM-DD */
  start: string;
  /** YYYY-MM-DD. 없으면 deadlineText가 있다 */
  deadline?: string;
  deadlineText?: string;
  period: string;
  apply: string;
  note: string;
  url: string;
};

/** data/research-internships.json의 topics 한 건(연구실별 인턴 주제). 필드 그대로 */
export type ResearchTopic = {
  id: string;
  org: string;
  program: string;
  division: string;
  professor: string;
  lab: string;
  topic: string;
  category: string;
  crossSchool: string;
  eligibility: string;
  requirements: string;
  deadline: string;
  url: string;
};

type ResearchInternships = { source: string; note: string; programs: ResearchProgram[]; topics: ResearchTopic[] };
const research = researchJson as ResearchInternships;

/** 연구인턴 공고 51건(사용자 제공 스냅샷 2026-11-21) */
export const researchPrograms: ResearchProgram[] = research.programs;
/** 연구실별 인턴 주제(RECOMMEND 연구실 탐색용) */
export const researchTopics: ResearchTopic[] = research.topics;

export type OpeningStatus = 'open' | 'closed' | 'unverified';

/** 화면 문구. 정확히 이 셋만 쓴다 */
export const OPENING_STATUS_LABELS: Record<OpeningStatus, string> = {
  open: '모집 중',
  closed: '마감',
  unverified: '확인 필요',
};

/** 날짜만 있는 값(YAML date, YYYY-MM-DD)은 UTC 자정으로 들어오므로 그 날짜를 그대로 꺼낸다 */
function dayOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * 공고 상태. 날짜는 서울 기준으로 비교하고 시작일·마감일 당일은 기간 안이다.
 * - 마감일이 지났으면 verified와 관계없이 closed
 * - 원문에서 기간을 확인했고(verified) 원본 링크가 있고 마감일이 있으며 기간 안이면 open
 * - 그 밖(마감일 없음, verified:false, 시작 전, 링크 없음)은 unverified. 절대 open으로 추정하지 않는다
 */
export function openingStatus(o: Opening, now: Date): OpeningStatus {
  const today = seoulDay(now);
  if (o.deadline && today > dayOf(o.deadline)) return 'closed';
  if (!o.verified || !o.deadline || !o.url) return 'unverified';
  if (o.start && today < dayOf(o.start)) return 'unverified';
  return 'open';
}

/** YYYY-MM-DD만 날짜로 바꾼다. 형식이 다르면 undefined */
function parseDay(s: string | undefined): Date | undefined {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** data/interns.json 한 건을 기업 인턴 공고로 옮긴다 */
export function fromIntern(i: Intern): Opening {
  return {
    id: `intern-${i.id}`,
    kind: 'company-intern',
    org: i.company,
    title: i.title,
    url: i.url ?? '',
    verified: i.verified,
    eligibility: i.eligibility,
    start: parseDay(i.start),
    deadline: parseDay(i.deadline),
    tags: i.tags,
  };
}

/** YYYY-MM이면 그 달 1일, YYYY-MM-DD면 그 날 */
function parseMonthOrDay(s: string | undefined): Date | undefined {
  return s && /^\d{4}-\d{2}$/.test(s) ? parseDay(`${s}-01`) : parseDay(s);
}

/**
 * data/research-internships.json 연구인턴 한 건을 대학원 연구실 인턴 공고로 옮긴다.
 * 스냅샷이라 마감일이 날짜로 있을 때만 verified로 본다. 날짜가 없으면 deadlineText를 그대로 보인다.
 */
export function fromResearchProgram(p: ResearchProgram): Opening {
  const deadline = parseDay(p.deadline);
  return {
    id: `rp-${p.id}`,
    kind: 'lab-intern',
    org: p.org,
    title: p.program,
    url: p.url,
    verified: deadline !== undefined,
    target: `${p.eligibility} (타교 지원: ${p.crossSchool})`,
    eligibility: p.note || undefined,
    start: parseMonthOrDay(p.start),
    deadline,
    deadlineText: deadline ? undefined : p.deadlineText,
    tags: p.field
      .split('·')
      .map((t) => t.replace(/\s*등$/, '').trim())
      .filter(Boolean),
  };
}

/** content/openings 컬렉션 항목과 같은 모양(CollectionEntry<'openings'>를 그대로 넘기면 된다) */
type OpeningEntry = { id: string; data: OpeningData };

/** 세 출처(content/openings, 기업 인턴, 연구인턴)를 합쳐 마감일 오름차순으로 돌려준다. 마감일이 없는 공고는 뒤로 간다 */
export function loadOpenings(collection: OpeningEntry[], interns: Intern[], programs: ResearchProgram[]): Opening[] {
  const fromContent = collection.map(({ id, data }): Opening => ({
    id,
    kind: data.kind,
    org: data.org,
    title: data.title,
    url: data.url,
    verified: data.verified,
    target: data.target,
    eligibility: data.eligibility,
    start: data.start,
    deadline: data.deadline,
    tags: data.tags,
    lab: data.lab,
  }));
  const all = [...fromContent, ...interns.map(fromIntern), ...programs.map(fromResearchProgram)];
  return all.sort((a, b) => {
    if (!a.deadline || !b.deadline) return a.deadline ? -1 : b.deadline ? 1 : 0;
    return a.deadline.getTime() - b.deadline.getTime();
  });
}
