# 공부 기록·다음 공부·진로 추천 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 수강 과목·읽은 논문·공부자료를 기록하고, 그 기록을 근거로 다음 공부와 DGIST 연구실·기업 인턴을 추천해 메인 화면과 상세 페이지에 보여준다.

**Architecture:** 공부 기록은 기존 `content/entries/`에 종류 3개를 더해 담는다. 추천은 GitHub Actions의 Claude가 새 스킬 `recommend`로 `content/next/`·`content/matches/` Markdown을 쓰고, 기존 PR·빌드 검증 흐름으로 반영된다. 연구실·인턴·과목 데이터는 `data/*.json`으로 저장소에 넣어 스킬과 사이트가 같이 읽는다.

**Tech Stack:** 기존 그대로(Astro, astro/zod, motion, yaml, vitest). 새 의존성 없음.

**Spec:** `docs/superpowers/specs/2026-11-21-study-career-design.md` (기존 `2026-11-21-archive-system-design.md`에 더하는 내용)

## Global Constraints

- 기존 계획 `2026-11-21-archive-system.md`의 Global Constraints를 모두 따른다(한국어 UI, `BASE_URL` 기준 링크, 비공개 비노출, 기본 테마·폰트, 스프링 `bounce: 0, duration: 0.4`, reduced-motion이면 페이드, AI는 사실을 지어내지 않음).
- 새 항목 종류 키는 정확히 `course paper study`, 라벨은 `수강 과목 읽은 논문 공부자료`. `TYPE_ORDER`(이력서 순서)에는 넣지 않는다. 그래서 이력서와 맞춤 이력서에 나오지 않는다.
- 본문 섹션 제목은 정확히 `## 배운 점`, `## 남은 질문`.
- 졸업학점 링크는 `https://my.dgist.ac.kr/com/portal/index.do`, 버튼 문구는 `졸업학점 확인`, 보조 문구는 `포털 퀵메뉴 → 졸업시뮬레이션`.
- 인턴 모집 배지 문구는 정확히 `모집 중`, `모집 예정`, `마감`, `모집 정보 확인 필요`.
- 추천 근거 `from`에는 공개 항목 ID만 쓴다. 화면은 존재하지 않거나 비공개인 ID를 근거 목록에서 뺀다.
- 연구실·인턴에 대한 서술은 `data/*.json`에 있는 내용만 쓴다.
- localStorage 키: 공부 계획은 `plan`(문자열 배열 JSON). 항목 ID 형식은 `next:<slug>`, `match:<slug>`.

## Review Focus

1. **근거 ID가 없거나 비공개** — `from`의 ID가 삭제됐거나 `public: false`여도 빌드는 통과하고, 그 ID는 근거 목록에서 빠진다. 공개 근거가 하나도 남지 않으면 그 추천 카드는 나오지 않는다. (Task 10 `resolveFrom` 테스트, Task 13 카드 필터)
2. **`target`이 데이터에 없음** — 데이터를 갱신하다 교수 ID가 사라져도 `/match/<slug>`는 렌더되고, 원본 링크 자리에는 "원본 자료를 찾을 수 없어요"가 나온다. (Task 9 `findTarget` 테스트)
3. **인턴 날짜가 비었거나 형식이 이상함, 오늘이 마감일** — 마감일 당일은 `모집 중`이다. 날짜를 읽을 수 없거나 공고 링크가 없으면 `모집 정보 확인 필요`다. (Task 10 `recruitStatus` 테스트)
4. **localStorage 차단이나 깨진 `plan` 값** — [계획에 담기]를 눌러도 오류가 나지 않고, `/plan`은 "이 브라우저에는 저장할 수 없어요"를 보여준다. 깨진 JSON은 빈 목록으로 읽는다. (Task 13 `planStore` 테스트)
5. **AI가 허용 범위 밖 경로를 씀** — `content/next/`·`content/matches/` 밖이나 `data/`를 고치려 하면 워크플로가 거부하고, 스키마 위반이면 기존 빌드 검증에서 병합하지 않는다. (Task 11 `contentPath` 테스트)

## 배정과 순서

GPT-3은 디자인 개선 고정이다. Task 9~13의 담당은 AGENTS.md 배정표를 따른다. 리더가 상황에 따라 바꿀 수 있다.

| Task | 담당 | 시작 조건 |
|---|---|---|
| 9 외부 데이터 | 유동 | 참고 저장소 작성자의 사용 허락, 리더가 `data/courses.json` 원본을 PR로 제공한 뒤 |
| 10 스키마·공부 기록·샘플 | 유동 | 지금 |
| 11 recommend 스킬·워크플로 | 유동 | 지금. `contentPath`와 스킬 초안부터 쓰고, 샘플 파일 형식은 Task 10 Interfaces를 따른다 |
| 12 메인 탭·오른쪽 패널·프로필 줄 | 유동 | Task 10 병합 후 |
| 13 추천 카드·상세·공부 계획 | 유동 | Task 10 병합 후. `/match` 상세는 Task 9 병합 후 마무리 |
| 디자인 개선 | **GPT-3 고정** | 지금. 기존 화면부터 다듬고, Task 12·13은 병합된 뒤에 다듬는다. 작업 전에 저장소의 `.claude/skills/apple-design/SKILL.md`를 반드시 읽는다 |

## File Structure

```
data/labs.json  data/interns.json  data/courses.json   # Task 9 (courses는 리더 제공)
scripts/import-data.mjs                                # Task 9: 참고 저장소 원본 → data/*.json
src/lib/data.ts                                        # Task 9: 타입·로더·findTarget
src/lib/types.ts  src/lib/schema.ts  src/content.config.ts  src/lib/profile.ts  src/lib/issue.ts  profile.yml   # Task 10 수정
src/lib/study.ts  src/lib/recommend.ts                 # Task 10
content/entries/2026-03-general-biology.md  content/entries/2026-10-dna-repair-paper.md
content/next/2026-11-replication-stress.md  content/matches/2026-11-genome-instability-lab.md   # Task 10 샘플
.claude/skills/recommend/SKILL.md  .github/ISSUE_TEMPLATE/recommend.yml   # Task 11
.github/workflows/ai.yml  .github/scripts/ai-content.mjs  CLAUDE.md       # Task 11 수정
src/components/StudyTabs.astro  src/components/DetailPanel.astro  src/pages/index.astro   # Task 12
src/lib/plan.ts  src/components/NextCard.astro  src/components/MatchCard.astro  src/components/RecommendPreview.astro  src/components/PlanButton.astro
src/pages/next/index.astro  src/pages/next/[slug].astro  src/pages/match/index.astro  src/pages/match/[slug].astro  src/pages/plan/index.astro   # Task 13
```

---

### Task 9: 외부 데이터 (연구실·인턴·과목)

**Files:**
- Create: `scripts/import-data.mjs`, `data/labs.json`, `data/interns.json`, `src/lib/data.ts`
- Receive: `data/courses.json` (리더가 포털 교과과정표에서 추출해 먼저 PR로 넣는다)
- Test: `tests/data.test.ts`

**Interfaces:**
- Consumes: 참고 저장소 `ililllilll/LAB-INTERN-MATCH-AI`의 `graduate/assets/runtime/display-records.json`, `graduate/assets/runtime/dgist-professor-enrichment.json`, `intern/data.js`
- Produces (`src/lib/data.ts`):
  ```ts
  export interface Lab { id: string; name: string; dept: string; lab?: string; homepage?: string; summary: string; courses: string[]; internTopics: string[] }
  export interface Intern { id: string; company: string; title: string; category: string; tags: string[]; start?: string; deadline?: string; url?: string; verified: boolean; eligibility?: string }
  export interface Course { code: string; name: string; kind: string; year: number; credits: number; prereq: string[] }
  export const labs: Lab[]; export const interns: Intern[]; export const courses: Course[];
  export function findTarget(kind: 'lab' | 'company' | 'intern', target: string): { title: string; url?: string } | undefined
  ```
  `findTarget`: lab은 `Lab.id`로 찾아 `{title: '<name> 교수 · <lab ?? dept>', url: homepage}`를 돌려준다. intern은 `Intern.id`로 찾아 `{title: '<company> <title>', url}`을 돌려준다. company는 `Intern.company`가 같은 첫 공고로 찾아 `{title: company}`를 돌려준다.

- [ ] **Step 1: 실패하는 테스트**
  ```ts
  test('DGIST 연구실 157곳, ID 중복 없음', () => { expect(labs.length).toBe(157); expect(new Set(labs.map(l => l.id)).size).toBe(157); });
  test('샘플이 쓰는 연구실이 있다', () => { expect(findTarget('lab', 'DGIST_NEWBIO_003')?.title).toContain('기영훈'); });
  test('없는 target은 undefined', () => { expect(findTarget('lab', 'NOPE')).toBeUndefined(); });
  test('인턴 날짜는 YYYY-MM-DD이거나 없음', () => { for (const i of interns) for (const d of [i.start, i.deadline]) if (d) expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/); });
  test('과목 코드 중복 없음', () => { expect(new Set(courses.map(c => c.code)).size).toBe(courses.length); });
  ```
- [ ] **Step 2:** `npx vitest run tests/data.test.ts` → FAIL.
- [ ] **Step 3: `scripts/import-data.mjs <원본폴더>` 작성.** DGIST 레코드(`universityCode === 'DGIST'`)를 다음처럼 옮긴다.
  - `id=professorId`, `name=nameKo`, `dept=affiliations[0].departmentNameKo`, `lab=labNames[0] ?? 하계인턴.labNameKo`, `homepage=officialUrl || homepage`, `summary=summaryKo`
  - `courses`는 `curriculum2025ByProfessorId[id].courses`에서 `자율적 수강 추천`을 뺀 것이다.
  - `internTopics`는 `summerInternship2026ByProfessorId[id].items[].text`다.
  - 인턴은 `id=record_id`, `title=internship_name`, `category=primary_category`, `tags=job_tags`를 `,`로 나눠 trim, `start=application_start`, `deadline=application_deadline`(형식이 안 맞으면 생략), `url=source_url`, `verified = verification_status === '검증됨'`, `eligibility=eligibility_summary`로 옮긴다.
  - JSON은 2칸 들여쓰기로 쓴다. 원본은 저장소에 넣지 않는다.
- [ ] **Step 4:** 원본을 받아 스크립트를 실행하고, `src/lib/data.ts`가 세 JSON을 import하게 만든다. `npx vitest run tests/data.test.ts` → PASS.
- [ ] **Step 5:** `npm test && npm run build` 통과. Commit `feat: 연구실·인턴·과목 데이터`. PR 본문에 원본 출처와 작성자 허락 내용을 적는다.

---

### Task 10: 스키마 확장·공부 기록 도우미·샘플

**Files:**
- Modify: `src/lib/types.ts`, `src/lib/schema.ts`, `src/content.config.ts`, `src/lib/profile.ts`, `src/lib/issue.ts`, `profile.yml`
- Create: `src/lib/study.ts`, `src/lib/recommend.ts`, 샘플 4개(File Structure 참고)
- Test: `tests/schema.test.ts`, `tests/entries.test.ts`, `tests/profile.test.ts` 보강, `tests/study.test.ts`, `tests/recommend.test.ts`

**Interfaces:**
- Produces:
  - `ENTRY_TYPES`에 `'course','paper','study'` 추가, `TYPE_LABELS` 추가, `export const STUDY_TYPES = ['course','paper','study'] as const`. `TYPE_ORDER`는 그대로 둔다.
  - `entrySchema`에 `topics: z.array(z.string()).default([])`, `course_code: z.string().optional()`를 추가한다.
  - `nextSchema`: `{ topic: string; created: date; from: string[] (min 1); learned: string[]; next: string[] (min 1); resources: { label: string; url?: url; course?: string }[] = []; questions: string[] = [] }`
  - `matchSchema`: `{ kind: 'lab'|'company'|'intern'; target: string; created: date; score: number 0~100; reason: string; from: string[] (min 1); check: string[] = []; sources: { label: string; url: url }[] = [] }`
  - collections `next`(`content/next/*.md`), `matches`(`content/matches/*.md`). id는 파일명에서 `.md`를 뺀 값이다.
  - `Profile.interests: string[]`(없으면 `[]`). `profile.yml`에 주석 달린 예시 `interests: [DNA 손상 반응, 로봇 제어]`를 둔다.
  - `IssueLabel`에 `'recommend'`를 추가한다.
  - `study.ts`: `section(body: string, heading: '배운 점' | '남은 질문'): string`는 `## <heading>` 다음 줄부터 다음 `## ` 전까지를 trim해서 돌려주고, 없으면 `''`다. `groupByTopic<T extends EntryLike & { data: { topics: string[] } }>(xs: T[]): { topic: string; items: T[] }[]`는 `topics[0]`으로 묶고 없으면 `기타`로 묶는다. `기타`는 맨 뒤, 나머지는 가나다순이고 그룹 안은 최신순이다.
  - `recommend.ts`: `resolveFrom<T extends EntryLike>(ids: string[], entries: T[]): T[]`는 ids 순서를 유지하고, 없거나 비공개인 것은 뺀다. `recruitStatus(x: { start?: string; deadline?: string; url?: string }, today: Date): '모집 중' | '모집 예정' | '마감' | '모집 정보 확인 필요'`는 날짜를 Asia/Seoul 기준 날짜 문자열로 비교한다.

- [ ] **Step 1: 실패하는 테스트**
  ```ts
  test('course 항목이 스키마 통과, topics 기본값 []', () => { expect(entrySchema.parse({ type:'course', title:'일반생물학 I', date:'2026-03', summary:'s' }).topics).toEqual([]); });
  test('groupByType(이력서)은 공부 기록을 뺀다', () => { expect(groupByType([e('a','course'), e('b','project')]).map(g => g.type)).toEqual(['project']); });
  test('section은 다음 ## 전까지', () => { expect(section('## 배운 점\n복제 포크\n\n## 남은 질문\n왜?', '배운 점')).toBe('복제 포크'); expect(section('본문', '남은 질문')).toBe(''); });
  test('groupByTopic: 기타는 맨 뒤', () => { expect(groupByTopic([t('a',[]), t('b',['생물'])]).map(g => g.topic)).toEqual(['생물','기타']); });
  test('resolveFrom: 없는 ID·비공개 제외, 순서 유지', () => { expect(resolveFrom(['x','b','a'], [pub('a'), priv('b')]).map(x => x.id)).toEqual(['a']); });
  test('마감일 당일은 모집 중', () => { expect(recruitStatus({ deadline:'2026-11-21', url:'https://x' }, new Date('2026-11-21T23:00:00+09:00'))).toBe('모집 중'); });
  test('지난 마감·시작 전·정보 없음', () => {
    const now = new Date('2026-11-21T12:00:00+09:00');
    expect(recruitStatus({ deadline:'2026-11-20', url:'https://x' }, now)).toBe('마감');
    expect(recruitStatus({ start:'2026-12-01', deadline:'2026-12-10', url:'https://x' }, now)).toBe('모집 예정');
    expect(recruitStatus({ deadline:'2026-12-10' }, now)).toBe('모집 정보 확인 필요');
    expect(recruitStatus({ deadline:'곧', url:'https://x' }, now)).toBe('모집 정보 확인 필요');
  });
  test('matchSchema: from이 비면 실패', () => { expect(() => matchSchema.parse({ kind:'lab', target:'X', created:'2026-11-21', score:80, reason:'r', from:[] })).toThrow(); });
  test('profile interests 기본값', () => { expect(loadProfile(MIN_YAML).interests).toEqual([]); });
  ```
  (`e`, `t`, `pub`, `priv`, `MIN_YAML`은 기존 테스트 파일의 헬퍼 방식대로 만든다.)
- [ ] **Step 2:** `npm test` → 새 테스트 FAIL.
- [ ] **Step 3:** Interfaces대로 구현한다.
- [ ] **Step 4: 샘플 작성.** 개요의 시연 예시를 그대로 쓴다. 모두 `public: true`.
  - `2026-03-general-biology.md`: course, `topics: [DNA 손상 반응]`, 배운 점은 DNA 복제·전사의 기본 개념이다.
  - `2026-10-dna-repair-paper.md`: paper, 제목 `DNA 손상복구 리뷰 논문 읽기`, `topics: [DNA 손상 반응]`, `## 남은 질문`에 `전사와 복제가 충돌하면 왜 복제 포크에 문제가 생길까?`를 쓴다. 실제 논문 서지(저자·DOI)는 지어내지 않는다.
  - `content/next/2026-11-replication-stress.md`: `topic: 복제 포크 스트레스와 DNA 손상 반응`, from은 위 두 ID, next는 `[전사-복제 충돌, 복제 포크 스트레스, DNA 손상 반응 신호]`, resources는 과목명만(`course: 유전학`), questions는 1개다.
  - `content/matches/2026-11-genome-instability-lab.md`: `kind: lab`, `target: DGIST_NEWBIO_003`, score 82, reason은 데이터 요약 "유전체 불안정성과 암 발생의 관계를 연구한다"와 위 질문을 연결한 한 문장, `check: [하계 인턴 참여 여부와 모집 시기 확인]`.
- [ ] **Step 5:** `npm test && npm run build` 통과. Commit `feat: 공부 기록 종류와 추천 스키마`.

---

### Task 11: recommend 스킬·이슈 템플릿·워크플로

**Files:**
- Create: `.claude/skills/recommend/SKILL.md`, `.github/ISSUE_TEMPLATE/recommend.yml`
- Modify: `.github/workflows/ai.yml`, `.github/scripts/ai-content.mjs`, `CLAUDE.md`(제품 규칙 부분)
- Test: `tests/ai-content.test.ts`

**Interfaces:**
- Consumes: Task 10 `nextSchema`·`matchSchema` 필드, Task 9 `data/*.json` 필드
- Produces: `export function contentPath(path: string): 'entry' | 'application' | 'next' | 'match' | null` (`ai-content.mjs`). 기존 `entryPattern`·`applicationPattern`에 `^content/next/<slug>\.md$`, `^content/matches/<slug>\.md$`를 더한다(slug 규칙은 기존과 같다). 파일을 반영하는 루프는 이 함수가 `null`이면 거부한다.

- [ ] **Step 1: 실패하는 테스트**
  ```ts
  test('허용 경로', () => {
    expect(contentPath('content/next/2026-11-a.md')).toBe('next');
    expect(contentPath('content/matches/2026-11-a.md')).toBe('match');
    expect(contentPath('content/entries/2026-11-a.md')).toBe('entry');
  });
  test('거부 경로', () => { for (const p of ['data/labs.json','content/next/../x.md','content/matches/a/b.md','profile.yml']) expect(contentPath(p)).toBeNull(); });
  ```
  모듈을 import할 때 CLI 동작이 실행되지 않도록 `import.meta.url === pathToFileURL(process.argv[1]).href`일 때만 main을 돌린다.
- [ ] **Step 2:** FAIL → 구현 → PASS.
- [ ] **Step 3: `SKILL.md`(frontmatter `name: recommend`, description에 "다음 공부와 연구실·기업·인턴 추천" 포함).** 아래 규칙을 쓴다.
  - 읽을 것: `profile.yml`의 `interests`, 공개 항목 전체(특히 course·paper·study의 `## 배운 점`·`## 남은 질문`), `data/labs.json`·`data/interns.json`·`data/courses.json`
  - 쓸 것: `content/next/`는 관심 주제당 1개씩 최대 3개, `content/matches/`는 최대 5개(연구실 우선, 인턴과 기업은 내 기록과 직무 태그가 맞을 때만). 같은 주제나 대상의 기존 파일이 있으면 그 slug를 갱신한다.
  - 근거: 모든 파일의 `from`에는 실제 공개 항목 ID를 1개 이상 넣는다. 연구실·인턴 서술과 `sources` URL은 데이터에 있는 값만 쓴다. `resources.course`는 `courses.json`이나 그 연구실의 `courses`에 있는 과목명만 쓴다.
  - 본문에는 "어떤 기록의 어떤 질문에서 출발했는지"를 두세 문장으로 쓴다.
- [ ] **Step 4: `recommend.yml` 이슈 템플릿.** 라벨은 `recommend`, 선택 입력은 "특히 알고 싶은 분야"다.
- [ ] **Step 5: `ai.yml` 수정.**
  - 트리거 라벨 목록에 `recommend`를 더하고, route 순서는 `['job','memo','essay','archive','recommend']`로 한다.
  - prompt에 두 줄을 더한다. route가 archive/memo이고 status가 ready면 recommend SKILL.md도 따라 추천 파일을 `files`에 함께 넣는다. route가 recommend면 recommend SKILL.md만 따른다.
  - 커밋·PR 제목 형식(`archive: <제목>`)은 그대로 둔다.
- [ ] **Step 6: `CLAUDE.md` 콘텐츠 형식 표.** `content/next/<slug>.md`·`content/matches/<slug>.md`의 필수·선택 필드(Task 10 Interfaces와 같게)를 추가한다. 1번 규칙에는 "`recommend`는 recommend 스킬"과 "archive·memo가 ready면 recommend도 함께 갱신"을 추가한다. 첫 줄 `@AGENTS.md`는 그대로 둔다.
- [ ] **Step 7:** `npm test && npm run build`. 포크나 테스트 저장소에서 `recommend` 이슈 하나로 PR 생성·병합·배포까지 확인한다. 실행 로그 링크를 PR 본문에 적는다. Commit `feat: recommend 스킬과 추천 자동화`.

---

### Task 12: 메인 탭·오른쪽 패널·프로필 줄

**Files:**
- Create: `src/components/StudyTabs.astro`, `src/components/DetailPanel.astro`
- Modify: `src/pages/index.astro`

**Interfaces:**
- Consumes: `STUDY_TYPES`, `TYPE_LABELS`, `section`, `groupByTopic`, `publicOnly`, `sortByDate`, `withBase`
- Produces: `DetailPanel`은 `[data-detail-open][data-detail-id]` 버튼으로 열린다. 내용은 서버에서 렌더한 `<template data-detail="<id>">`를 복제해 채운다(Task 13 상세 페이지도 같은 방식으로 재사용할 수 있다).

- [ ] **Step 1:** 시작 전에 `.claude/skills/apple-design/SKILL.md`와 `src/components/MemoPanel.astro`의 열기·닫기 코드를 읽는다.
- [ ] **Step 2: 프로필 줄.** 히어로 바로 아래에 [CV 열기](`withBase('resume/')`)와 [졸업학점 확인](Global Constraints의 URL, 새 탭, `rel="noopener"`, 보조 문구 포함)을 둔다.
- [ ] **Step 3: `StudyTabs`.**
  - `role="tablist"`, 탭 2개 `공부 기록`·`활동·포트폴리오`를 두고 `aria-selected`와 좌우 화살표 키 이동을 지원한다.
  - 공부 기록은 `groupByTopic(공개 STUDY_TYPES 항목)`이고, 활동은 공개 항목 중 STUDY_TYPES가 아닌 것을 최신순으로 둔다.
  - 처음 열릴 때는 공부 기록이 하나라도 있으면 공부 기록 탭, 없으면 활동 탭이다.
- [ ] **Step 4: `DetailPanel`.**
  - 위치·폭·스프링·Esc·포커스 복귀·reduced-motion은 MemoPanel과 같고, 스크림은 없다.
  - 공부 기록이면 `배운 점`·`남은 질문`을 보여주고, 빈 섹션은 "아직 적지 않았어요"로 표시한다.
  - 활동이면 `role`·`org`·기간·`summary`를 보여주고, featured면 포트폴리오 상세 링크를 둔다.
- [ ] **Step 5:** `npm run build && npx astro preview`로 확인한다. 탭 전환, 패널 열기·닫기·포커스 복귀, `BASE_PATH=/other` 빌드의 링크, 비공개 샘플(`2026-10-private-note`)이 안 나오는지 본다.
- [ ] **Step 6:** `npm test` 통과. Commit `feat: 메인 공부 기록 탭과 오른쪽 패널`.

---

### Task 13: 추천 카드·상세 페이지·공부 계획

**Files:**
- Create: `src/lib/plan.ts`, `src/components/NextCard.astro`, `src/components/MatchCard.astro`, `src/components/RecommendPreview.astro`, `src/components/PlanButton.astro`, `src/pages/next/index.astro`, `src/pages/next/[slug].astro`, `src/pages/match/index.astro`, `src/pages/match/[slug].astro`, `src/pages/plan/index.astro`
- Test: `tests/plan.test.ts`
- 필요한 변경(리더가 반영): `src/pages/index.astro`의 StudyTabs 아래에 `<RecommendPreview />` 한 줄

**Interfaces:**
- Consumes: `resolveFrom`, `recruitStatus`, `findTarget`, `interns`, `issueUrl`, `Profile.repo`
- Produces: `planStore(storage: Storage | null): { ok: boolean; list(): string[]; has(id: string): boolean; toggle(id: string): boolean }`. 키는 `plan`(JSON 문자열 배열)이다. `toggle`은 바뀐 뒤 포함 여부를 돌려준다. 깨진 JSON이나 배열이 아닌 값은 `[]`로 읽는다. 접근이 throw하면 `ok:false`이고, `toggle`은 저장하지 않고 `false`를 돌려준다.

- [ ] **Step 1: 실패하는 테스트**
  ```ts
  test('담기·빼기', () => { const p = planStore(mem()); expect(p.toggle('next:a')).toBe(true); expect(p.has('next:a')).toBe(true); expect(p.toggle('next:a')).toBe(false); expect(p.list()).toEqual([]); });
  test('깨진 JSON은 빈 목록', () => { const s = mem({ plan: '{oops' }); expect(planStore(s).list()).toEqual([]); });
  test('차단된 storage', () => { const p = planStore(blocked()); expect(p.ok).toBe(false); expect(p.toggle('x')).toBe(false); });
  ```
  (`mem`, `blocked`는 `tests/memo.test.ts`의 방식대로 만든다.)
- [ ] **Step 2:** FAIL → 구현 → PASS.
- [ ] **Step 3: 카드.**
  - 공통: 근거 기록은 `resolveFrom`으로 걸러 제목을 칩으로 보여주고, 걸러진 근거가 0개면 카드를 렌더하지 않는다.
  - `NextCard`: topic, `learned` → `next` 흐름(화살표), resources 앞 2개, `PlanButton`
  - `MatchCard`: `findTarget`의 title(없으면 target 그대로), kind 라벨(`연구실`·`기업`·`인턴`), score, reason. intern이면 `recruitStatus` 배지(오늘 날짜는 빌드 시점이 아니라 브라우저에서 계산)와 마감일을 붙인다.
- [ ] **Step 4: `RecommendPreview`.** "다음에 할 공부"는 created 최신 3개, "관심 분야와 맞는 기회"는 score 높은 3개다. 각 섹션에 [전체 보기] 링크를 두고, 0개인 섹션은 제목까지 렌더하지 않는다.
- [ ] **Step 5: 상세 페이지.**
  - `/next/<slug>`: 이미 공부한 내용 → 다음 개념 → 자료·과목 → 연구 질문, 본문, 근거 기록 `<details>`(각 항목의 `남은 질문` 포함)
  - `/match/<slug>`: reason, 본문, 지원 전 더 알아볼 점, sources와 findTarget url(없으면 "원본 자료를 찾을 수 없어요"), 근거 `<details>`
  - lab이면 [지원 자료 만들기] 버튼을 둔다. `issueUrl(repo, {label:'job', title:'[연구실] ' + title, body})`이고, body는 `.github/ISSUE_TEMPLATE/job.yml`의 항목 순서를 따르고 연구 요약·하계 인턴 주제·근거 항목 경로(`content/entries/<id>.md`)를 채운다.
  - 목록 `/next`·`/match`는 카드 전체를 보여준다.
- [ ] **Step 6: `/plan`.** 모든 next·match 카드를 렌더한 뒤, 브라우저에서 `planStore().list()`에 있는 것만 보이게 한다. 비었으면 "아직 담은 공부가 없어요", `ok:false`면 "이 브라우저에는 저장할 수 없어요"를 보여준다.
- [ ] **Step 7:** `npm test && npm run build` 통과. preview에서 샘플로 메인 미리보기 → 상세 → 계획 담기 → `/plan` → [지원 자료 만들기] URL을 확인한다. Commit `feat: 추천 카드·상세·공부 계획`.
