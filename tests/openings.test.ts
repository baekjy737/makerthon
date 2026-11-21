import { describe, expect, test } from 'vitest';
import { interns, type Intern } from '../src/lib/data';
import {
  fromIntern,
  fromResearchProgram,
  loadOpenings,
  OPENING_KINDS,
  OPENING_LABELS,
  openingStatus,
  researchPrograms,
  type Opening,
  type ResearchProgram,
} from '../src/lib/openings';
import { openingSchema } from '../src/lib/schema';

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const op = (o: Partial<Opening> = {}): Opening => ({
  id: 'x',
  kind: 'lab-intern',
  org: 'DGIST',
  title: 't',
  url: 'https://example.com',
  verified: true,
  tags: [],
  ...o,
});
// 서울 2026-11-21 정오
const NOW = new Date('2026-11-21T12:00:00+09:00');

describe('openingStatus', () => {
  test('verified이고 start<=now<=deadline이면 open', () => {
    expect(openingStatus(op({ start: d('2026-11-01'), deadline: d('2026-12-01') }), NOW)).toBe('open');
    expect(openingStatus(op({ deadline: d('2026-12-01') }), NOW)).toBe('open');
  });

  test('시작일·마감일 당일도 open (서울 날짜 기준)', () => {
    expect(openingStatus(op({ start: d('2026-11-21'), deadline: d('2026-11-21') }), new Date('2026-11-21T23:30:00+09:00'))).toBe('open');
    // 서울 11-21 00:30 = UTC 11-20 15:30. 11-20 마감은 이미 지났다
    expect(openingStatus(op({ deadline: d('2026-11-20') }), new Date('2026-11-20T15:30:00Z'))).toBe('closed');
  });

  test('deadline<now이면 verified와 관계없이 closed', () => {
    expect(openingStatus(op({ deadline: d('2026-11-20') }), NOW)).toBe('closed');
    expect(openingStatus(op({ deadline: d('2026-11-20'), verified: false }), NOW)).toBe('closed');
  });

  test('마감일 없음·verified:false·시작일이 미래면 unverified (절대 open 아님)', () => {
    expect(openingStatus(op({ deadline: undefined }), NOW)).toBe('unverified');
    expect(openingStatus(op({ verified: false, deadline: d('2026-12-01') }), NOW)).toBe('unverified');
    expect(openingStatus(op({ start: d('2026-11-22'), deadline: d('2026-12-01') }), NOW)).toBe('unverified');
  });

  test('원본 공고 링크가 없으면 unverified', () => {
    expect(openingStatus(op({ url: '', deadline: d('2026-12-01') }), NOW)).toBe('unverified');
  });
});

describe('fromIntern', () => {
  test('INT-0016을 company-intern으로 매핑하고 eligibility를 옮김', () => {
    const i = interns.find((x) => x.id === 'INT-0016')!;
    const o = fromIntern(i);
    expect(o).toMatchObject({
      id: 'intern-INT-0016',
      kind: 'company-intern',
      org: '한화에어로스페이스',
      title: 'LS사업부 현장 전문직 인턴사원',
      url: 'https://linkareer.com/activity/290015',
      verified: true,
      eligibility: '학력 무관, 관련 전공 및 경력 우대, 병역 및 해외여행 결격 없음',
      tags: ['공정', '품질', '생산/제조'],
    });
    expect(o.start?.toISOString().slice(0, 10)).toBe('2025-12-22');
    expect(o.deadline?.toISOString().slice(0, 10)).toBe('2025-12-28');
    expect(openingStatus(o, NOW)).toBe('closed');
  });

  test('날짜·링크가 빠진 공고', () => {
    const i: Intern = { id: 'INT-9', company: 'A', title: 'B', category: 'c', tags: [], verified: true };
    const o = fromIntern(i);
    expect(o.url).toBe('');
    expect(o.start).toBeUndefined();
    expect(o.deadline).toBeUndefined();
    expect(openingStatus(o, NOW)).toBe('unverified');
  });

  test('121건 모두 company-intern, id 중복 없음', () => {
    const all = interns.map(fromIntern);
    expect(all.every((o) => o.kind === 'company-intern')).toBe(true);
    expect(new Set(all.map((o) => o.id)).size).toBe(interns.length);
  });
});

describe('fromResearchProgram', () => {
  test('RP26-001(POSTECH 기계공학과 동계 연구인턴)을 lab-intern·verified로 매핑', () => {
    const p = researchPrograms.find((x) => x.id === 'RP26-001')!;
    const o = fromResearchProgram(p);
    expect(o).toMatchObject({
      id: 'rp-RP26-001',
      kind: 'lab-intern',
      org: 'POSTECH',
      title: '기계공학과 동계 연구인턴',
      url: 'https://me.postech.ac.kr/ko/board/view?bd_id=notice&wr_id=957',
      verified: true,
      target: '타대학 포함 국내 이공계 학부 3~4학년 재학생 (타교 지원: 가능)',
      eligibility: '휴학생·졸업생 불가, 생활관 제공',
      tags: ['기계', '재료', '로봇'],
    });
    // start가 YYYY-MM이면 그 달 1일
    expect(o.start?.toISOString().slice(0, 10)).toBe('2026-10-01');
    expect(o.deadline?.toISOString().slice(0, 10)).toBe('2026-11-22');
    expect(o.deadlineText).toBeUndefined();
    expect(openingStatus(o, NOW)).toBe('open');
  });

  test('마감일이 없는 공고는 verified:false, deadlineText를 옮기고 확인 필요', () => {
    const p = researchPrograms.find((x) => x.id === 'RP26-012')!;
    const o = fromResearchProgram(p);
    expect(o.verified).toBe(false);
    expect(o.deadline).toBeUndefined();
    expect(o.deadlineText).toBe('공고 확인');
    // YYYY-MM-DD 시작일은 그대로
    expect(o.start?.toISOString().slice(0, 10)).toBe('2026-11-09');
    expect(openingStatus(o, NOW)).toBe('unverified');
  });

  test('분야의 "등"은 태그에서 뺀다', () => {
    const o = fromResearchProgram({ ...researchPrograms[0], field: '양자·전자소재·로봇 등' });
    expect(o.tags).toEqual(['양자', '전자소재', '로봇']);
  });

  test('51건 모두 lab-intern, id 중복 없음, verified는 마감일이 있을 때만', () => {
    const all = researchPrograms.map(fromResearchProgram);
    expect(all).toHaveLength(51);
    expect(all.every((o) => o.kind === 'lab-intern')).toBe(true);
    expect(new Set(all.map((o) => o.id)).size).toBe(51);
    for (const o of all) expect(o.verified).toBe(o.deadline !== undefined);
  });
});

describe('loadOpenings', () => {
  const entry = (id: string, deadline?: string) => ({
    id,
    data: openingSchema.parse({ kind: 'lab-intern', org: 'DGIST', title: id, url: 'https://example.com', created: '2026-11-21', deadline }),
  });
  const intern = (id: string, deadline?: string): Intern => ({ id, company: 'A', title: id, category: 'c', tags: [], verified: true, deadline, url: 'https://x' });

  test('마감일 오름차순, 마감일 없는 건 뒤로, 콘텐츠와 인턴 데이터를 합침', () => {
    const r = loadOpenings([entry('c-late', '2026-12-31'), entry('c-none')], [intern('I1', '2026-12-01'), intern('I2')], []);
    expect(r.map((o) => o.id)).toEqual(['intern-I1', 'c-late', 'c-none', 'intern-I2']);
  });

  test('연구인턴 공고도 합쳐 같은 순서로 정렬', () => {
    const rp = (id: string, deadline?: string): ResearchProgram => ({
      id,
      orgType: '대학원',
      org: 'X',
      program: id,
      field: 'f',
      crossSchool: '가능',
      eligibility: 'e',
      start: '2026-11',
      period: 'p',
      apply: 'a',
      note: 'n',
      url: 'https://x',
      ...(deadline ? { deadline } : { deadlineText: '공고 확인' }),
    });
    const r = loadOpenings([entry('c', '2026-12-15')], [intern('I1', '2026-12-01')], [rp('R1', '2026-11-25'), rp('R2')]);
    expect(r.map((o) => o.id)).toEqual(['rp-R1', 'intern-I1', 'c', 'rp-R2']);
  });

  test('콘텐츠 항목은 frontmatter를 그대로 옮김', () => {
    const [o] = loadOpenings([entry('s', '2026-12-31')], [], []);
    expect(o).toMatchObject({ id: 's', kind: 'lab-intern', org: 'DGIST', verified: false, tags: [] });
  });
});

describe('openingSchema·라벨', () => {
  test('유형 4개와 라벨', () => {
    expect(OPENING_KINDS).toEqual(['lab-intern', 'undergrad-research', 'company-intern', 'company-job']);
    expect(OPENING_LABELS).toEqual({
      'lab-intern': '대학원 연구실 인턴',
      'undergrad-research': '연구과제 학부연구생',
      'company-intern': '기업 인턴',
      'company-job': '기업 채용',
    });
  });

  test('기본값과 검증', () => {
    const base = { kind: 'undergrad-research', org: 'DGIST', title: 't', url: 'https://example.com', created: '2026-11-21' };
    const o = openingSchema.parse(base);
    expect(o.verified).toBe(false);
    expect(o.tags).toEqual([]);
    expect(() => openingSchema.parse({ ...base, url: 'not a url' })).toThrow();
    expect(() => openingSchema.parse({ ...base, kind: 'job' })).toThrow();
    expect(openingSchema.parse({ ...base, deadline: '2026-12-01' }).deadline).toBeInstanceOf(Date);
  });
});
