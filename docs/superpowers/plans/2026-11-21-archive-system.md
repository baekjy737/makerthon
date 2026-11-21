# DGIST AI 아카이빙 시스템 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Markdown 항목 하나를 원본으로 아카이브·포트폴리오·이력서·지원 화면을 만드는 Astro 템플릿 사이트와, 이슈로 기록·공고 분석·자소서를 대신하는 Claude Code 자동화를 만든다.

**Architecture:** 정적 Astro 사이트. `content/entries/*.md`(항목)와 `content/applications/<slug>/`(지원 건)를 content collection으로 읽고, 순수 함수(`src/lib/`)가 필터·집계·이슈 URL을 만든다. AI는 `.claude/skills/` 스킬 3개를 로컬 Claude Code와 GitHub Action이 같이 쓴다. Action 결과 브랜치는 빌드 검증 후 main에 병합되고 Pages로 배포된다.

**Tech Stack:** Astro(latest, `npm create astro@latest`), TypeScript, Vitest, `yaml`, `motion`(메모 패널 스프링), `@vite-pwa/astro`, GitHub Actions(`withastro/action`, `actions/deploy-pages`, `anthropics/claude-code-action@v1`), Node 22.

**Spec:** `docs/superpowers/specs/2026-11-21-archive-system-design.md`

## Global Constraints

- 모든 UI 문구는 한국어.
- 항목 종류 키는 정확히 `project research award activity career education certificate etc`, 라벨은 `프로젝트 연구/논문 수상 대외활동/동아리 경력/인턴 학력 자격/어학 기타`.
- 내부 링크·에셋은 모두 `import.meta.env.BASE_URL` 기준(템플릿마다 저장소 이름이 다르다). 하드코딩된 `href="/..."` 금지.
- `public: false` 항목은 어떤 페이지·통계·이력서·맞춤 이력서에도 나오지 않는다.
- 기본 테마: `bg #0b0b0c`, `fg #f2f2f0`, `muted #8a8a8f`, `accent #3b82f6`(파랑). 기본 폰트: 한글 `NanumSquareNeo`(Naver CSS `https://hangeul.pstatic.net/hangeul_static/css/nanum-square-neo.css`, 굵기는 패밀리 이름으로: `NanumSquareNeoLight/NanumSquareNeo/NanumSquareNeoBold/NanumSquareNeoExtraBold/NanumSquareNeoHeavy`), 영문 디스플레이 `Anton`(Google Fonts).
- 움직임: 기본 스프링은 오버슈트 없음(`bounce: 0, duration: 0.4`). `prefers-reduced-motion: reduce`면 페이드만.
- AI는 사실(날짜·수치·역할·수상명)을 지어내지 않는다. 모르면 이슈 댓글로 묻고 해당 필드는 비운다.
- 새 의존성은 Tech Stack에 적힌 것만.

## Review Focus

1. **다른 저장소 이름으로 배포** — `BASE_PATH=/other` 빌드에서도 모든 링크·이미지·manifest가 `/other/`로 시작해야 한다. (Task 7 테스트)
2. **긴 메모로 이슈 URL 초과** — 메모가 수천 자여도 이슈 URL은 8000자 이하로 잘리고, 잘렸다는 안내가 본문에 들어가야 한다. (Task 6 테스트)
3. **localStorage 차단(시크릿 창 등)** — 메모 패널은 열리고, "이 브라우저에 저장할 수 없어요" 안내가 뜨며, AI에게 보내기는 여전히 동작해야 한다. (Task 6 테스트)
4. **AI가 스키마에 안 맞는 frontmatter를 씀** — 빌드가 실패하면 main에 병합하지 않고 이슈에 실패 댓글이 달려야 한다. 사이트는 이전 상태 유지. (Task 8 검증)
5. **비공개 항목 누출** — `public: false` 항목이 통계 숫자, 맞춤 이력서(공고 분석이 그 항목을 골랐어도)에 섞이지 않아야 한다. (Task 3·5 테스트)

---

## File Structure

```
astro.config.mjs            base/site, PWA 통합
profile.yml                 개인 정보·색·폰트 (학생이 고치는 유일한 설정 파일)
CLAUDE.md                   AI용 저장소 규칙(스키마, 사실 날조 금지)
content/entries/*.md        항목 (샘플 6개)
content/applications/<slug>/index.md, essay-<n>.md
src/content.config.ts       collections: entries, applications, essays
src/lib/types.ts            EntryType, TYPE_LABELS, TYPE_ORDER
src/lib/profile.ts          loadProfile()
src/lib/theme.ts            themeCss()
src/lib/entries.ts          publicOnly(), sortByDate(), groupByType()
src/lib/stats.ts            archiveStats()
src/lib/issue.ts            issueUrl()
src/lib/memo.ts             memoStore()
src/lib/url.ts              withBase()
src/layouts/Base.astro      head(폰트·테마·manifest), Nav
src/components/Nav.astro Hero.astro StatStrip.astro EntryCard.astro TypeFilter.astro MemoPanel.astro
src/pages/index.astro archive/index.astro portfolio/index.astro portfolio/[slug].astro
src/pages/resume/index.astro resume/[app].astro apply/index.astro apply/[app].astro manage/index.astro
src/styles/global.css print.css
tests/*.test.ts
.claude/skills/archive/SKILL.md job-analysis/SKILL.md essay/SKILL.md
.github/ISSUE_TEMPLATE/archive.yml job.yml essay.yml memo.yml
.github/workflows/deploy.yml ai.yml
public/icons/icon-192.png icon-512.png
README.md                   학생용 셋업 가이드
```

---

### Task 1: 스캐폴드 + 콘텐츠 스키마 + 샘플 데이터

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `src/content.config.ts`, `src/lib/types.ts`, `content/entries/*.md`(6개), `content/applications/sample-company/index.md`, `content/applications/sample-company/essay-1.md`, `.gitignore`
- Test: `tests/schema.test.ts`

**Interfaces:**
- Produces:
  - `type EntryType = 'project'|'research'|'award'|'activity'|'career'|'education'|'certificate'|'etc'`; `TYPE_ORDER: EntryType[]`(이력서 섹션 순서: education, career, project, research, award, activity, certificate, etc); `TYPE_LABELS: Record<EntryType,string>`
  - `entrySchema`(zod, `src/content.config.ts`에서 export): `type: EntryType`, `title: string`, `date: date`, `end?: date`, `org?: string`, `role?: string`, `summary: string`(이력서 한 줄, 최대 80자), `tags: string[]=[]`, `metrics: string[]=[]`, `featured: boolean=false`, `public: boolean=true`, `links: {label:string,url:string(url)}[]=[]`, `attachments: string[]=[]`(public/ 기준 경로)
  - `applicationSchema`: `company: string`, `position: string`, `url?: string`, `deadline?: date`, `created: date`, `requirements: string[]`, `matches: {entry: string /*entries id*/, score: number(0..100), reason: string}[]`, `gaps: string[]`
  - `essaySchema`: `question: string`, `limit?: number`, `entries: string[]=[]`
  - collections `entries`(glob `content/entries/**/*.md`), `applications`(glob `content/applications/*/index.md`, id = 폴더명), `essays`(glob `content/applications/*/essay-*.md`)

- [ ] **Step 1:** `npm create astro@latest . -- --template minimal --typescript strict --no-git --install`, then `npm i yaml motion && npm i -D vitest @vite-pwa/astro`. `package.json` scripts: `"test": "vitest run"`.
- [ ] **Step 2: Write the failing test** `tests/schema.test.ts`
```ts
import { entrySchema } from '../src/content.config';
test('기본값 채움', () => {
  const e = entrySchema.parse({ type:'award', title:'해커톤 2등', date:'2026-05-01', summary:'드론 경로 최적화로 2등' });
  expect(e.public).toBe(true); expect(e.featured).toBe(false); expect(e.tags).toEqual([]);
});
test('모르는 종류 거부', () => {
  expect(() => entrySchema.parse({ type:'hobby', title:'x', date:'2026-01-01', summary:'x' })).toThrow();
});
test('summary 80자 초과 거부', () => {
  expect(() => entrySchema.parse({ type:'etc', title:'x', date:'2026-01-01', summary:'가'.repeat(81) })).toThrow();
});
```
  `entrySchema`는 `astro/zod`의 `z`로 만들고 `date`는 `z.coerce.date()`. Vitest가 `astro:content`를 못 불러오면 스키마를 `src/lib/schema.ts`로 빼고 `content.config.ts`가 import.
- [ ] **Step 3:** Run `npm test` → FAIL(모듈 없음). 스키마·collections·types 구현 → PASS.
- [ ] **Step 4:** 샘플 항목 6개 작성(종류 6가지, 그중 1개 `public: false`, 2개 `featured: true`, 1개는 본문에 `## 자소서 재료` 섹션). 샘플 지원 건 1개(matches에 비공개 항목 id 포함 — Review Focus 5용).
- [ ] **Step 5:** Run `npm run build` → 성공.
- [ ] **Step 6: Commit** `feat: Astro 스캐폴드와 항목·지원 스키마`

---

### Task 2: 프로필·테마·기본 레이아웃

**Files:**
- Create: `profile.yml`, `src/lib/profile.ts`, `src/lib/theme.ts`, `src/lib/url.ts`, `src/layouts/Base.astro`, `src/components/Nav.astro`, `src/styles/global.css`
- Test: `tests/profile.test.ts`, `tests/theme.test.ts`

**Interfaces:**
- Produces:
  - `interface Profile { name:{ko:string; line1:string; line2:string; line3:string}; monogram:string; intro:string /* **굵게** 허용 */; photo?:string; email?:string; links:{label:string;url:string}[]; repo:string /* owner/name */; theme:Theme; fonts:Fonts }`
  - `interface Theme { bg:string; fg:string; muted:string; accent:string }` (CSS 색 문자열)
  - `interface Fonts { display:{family:string; css:string}; ko:{family:string; boldFamily:string; css:string} }`
  - `loadProfile(raw?: string): Profile` — `profile.yml` 읽고 빠진 값은 기본값(Global Constraints)으로 채움. `repo` 없으면 `process.env.GITHUB_REPOSITORY`, 그것도 없으면 throw(`profile.yml에 repo: owner/name 를 적어 주세요`).
  - `themeCss(t: Theme): string` → `:root{--bg:…;--fg:…;--muted:…;--accent:…}`
  - `withBase(path: string): string` — `import.meta.env.BASE_URL`과 슬래시 하나로 합침.
  - `<Base title description noindex?>` 레이아웃 슬롯.

- [ ] **Step 1: Write the failing tests**
```ts
// tests/profile.test.ts
test('색을 안 적으면 기본 파랑', () => {
  const p = loadProfile('name: {ko: 홍길동, line1: GILDONG, line2: HONG, line3: "ROBOTICS × AI"}\nmonogram: GD.26\nintro: 안녕\nrepo: a/b');
  expect(p.theme.accent).toBe('#3b82f6'); expect(p.fonts.ko.family).toBe('NanumSquareNeo'); expect(p.links).toEqual([]);
});
test('개인 색이 기본값을 덮음', () => {
  const p = loadProfile('name: {ko: a, line1: A, line2: B, line3: C}\nmonogram: X\nintro: x\nrepo: a/b\ntheme: {accent: "#ff6a00", bg: "#ffffff"}');
  expect(p.theme.accent).toBe('#ff6a00'); expect(p.theme.bg).toBe('#ffffff'); expect(p.theme.fg).toBe('#f2f2f0');
});
// tests/theme.test.ts
test('CSS 변수 생성', () => {
  expect(themeCss({bg:'#000',fg:'#fff',muted:'#888',accent:'#3b82f6'})).toBe(':root{--bg:#000;--fg:#fff;--muted:#888;--accent:#3b82f6}');
});
test('색 값에 ; 나 } 가 있으면 거부', () => {
  expect(() => themeCss({bg:'#000;}body{display:none',fg:'#fff',muted:'#888',accent:'#00f'})).toThrow();
});
```
- [ ] **Step 2:** Run `npm test` → FAIL. 구현 → PASS.
- [ ] **Step 3:** `Base.astro`: `<link>`로 `fonts.ko.css`, `fonts.display.css`; `<style set:html={themeCss(...)}>`; `noindex`면 `<meta name="robots" content="noindex">`; `body{background:var(--bg);color:var(--fg);font-family:var(--font-ko)}`. `Nav.astro`: 왼쪽 모노그램, 오른쪽 `ARCHIVE PORTFOLIO RESUME APPLY 관리` — 고정폭·자간 넓은 대문자 12px, `position:sticky` + `backdrop-filter: blur(20px) saturate(180%)` + 반투명 배경, 아래 경계는 border 대신 그라디언트 마스크. `prefers-reduced-transparency`면 불투명.
- [ ] **Step 4:** 나눔스퀘어 네오 라이선스 확인: 사용자에게 hangeul.naver.com 라이선스 페이지에서 "웹 임베딩 허용"을 확인해 달라고 요청. 불가면 기본 한글 폰트를 Pretendard(jsDelivr `pretendard@1.3.9`)로 바꾸고 Global Constraints를 고친다.
- [ ] **Step 5:** `npm run build` 성공 → **Commit** `feat: 프로필·테마 커스텀과 기본 레이아웃`

---

### Task 3: 히어로 + 기록 통계

**Files:**
- Create: `src/lib/entries.ts`, `src/lib/stats.ts`, `src/components/Hero.astro`, `src/components/StatStrip.astro`, `src/pages/index.astro`
- Test: `tests/entries.test.ts`, `tests/stats.test.ts`

**Interfaces:**
- Consumes: `Profile`, `withBase`, collection `entries`
- Produces:
  - `type EntryLike = { id: string; data: { type: EntryType; date: Date; public: boolean; featured: boolean } }` (CollectionEntry와 호환되는 최소 형태)
  - `publicOnly<T extends EntryLike>(xs: T[]): T[]`
  - `sortByDate<T extends EntryLike>(xs: T[]): T[]` — 최신순, 원본 배열 불변
  - `groupByType<T extends EntryLike>(xs: T[]): {type: EntryType; label: string; items: T[]}[]` — `TYPE_ORDER` 순서, 빈 그룹 제외
  - `archiveStats(xs: EntryLike[], now: Date): { total: number; projects: number; awards: number; daysSinceLast: number | null }` — 내부에서 `publicOnly` 적용

- [ ] **Step 1: Write the failing tests**
```ts
const e = (id, type, date, pub = true) => ({ id, data: { type, date: new Date(date), public: pub, featured: false } });
test('비공개는 통계에서 빠짐', () => {
  const s = archiveStats([e('a','project','2026-11-01'), e('b','award','2026-11-10', false)], new Date('2026-11-21'));
  expect(s).toEqual({ total: 1, projects: 1, awards: 0, daysSinceLast: 20 });
});
test('항목 없으면 daysSinceLast null', () => {
  expect(archiveStats([], new Date()).daysSinceLast).toBeNull();
});
test('groupByType은 이력서 순서, 빈 그룹 없음', () => {
  const g = groupByType([e('a','award','2026-01-01'), e('b','education','2020-03-01')]);
  expect(g.map(x => x.type)).toEqual(['education','award']);
});
```
- [ ] **Step 2:** Run → FAIL. 구현 → PASS.
- [ ] **Step 3:** `Hero.astro` (spec "화면 > 히어로" 그대로): 2열(사진 | 3줄 타이포), 모바일은 1열(사진 위). 타이포 `font-family: var(--font-display)`, `clamp(3rem, 9vw, 8rem)`, `line-height:0.95`, `letter-spacing:-0.01em`, 대문자. line2는 `color: var(--muted)` + 뒤에 포인트색 대시, line3의 `×`는 포인트색 span. 사진 없으면 `monogram`을 같은 자리에 크게. `intro`의 `**구절**`은 `<strong>`(흰색=`var(--fg)`, 나머지는 `var(--muted)`) — HTML 이스케이프 후 `**` 치환만. 배경 도트: `radial-gradient` 반복, 정지. 등장 애니메이션: 줄마다 80ms 간격 `translateY(24px)→0`, `opacity 0→1`, `cubic-bezier(0.2,0,0,1) 600ms`(오버슈트 없음); 사진은 `filter: blur(12px); scale(.96)`→원래. reduced-motion이면 opacity만. SCROLL 세로선: 스크롤 진행률로 `scaleY` 1:1(rAF, 반복 애니메이션 없음).
- [ ] **Step 4:** `StatStrip.astro`: `● 기록 {total}  프로젝트 {projects}  수상 {awards}  마지막 기록 {n}일 전`(null이면 마지막 기록 부분 생략, 0이면 "오늘"). 버튼 `포트폴리오 보기`→`/portfolio`, `이력서 PDF`→`/resume`.
- [ ] **Step 5:** `npm run build && npx astro preview`로 빌드·확인, 스크린샷을 사용자에게 보여 준다. **Commit** `feat: 히어로와 기록 통계`

---

### Task 4: 아카이브·포트폴리오 페이지

**Files:**
- Create: `src/components/EntryCard.astro`, `src/components/TypeFilter.astro`, `src/pages/archive/index.astro`, `src/pages/portfolio/index.astro`, `src/pages/portfolio/[slug].astro`

**Interfaces:**
- Consumes: `publicOnly`, `sortByDate`, `TYPE_LABELS`, `withBase`
- Produces: `<EntryCard entry href?>`(제목·종류 라벨·기간·org·summary·tags), `<TypeFilter>`(버튼 클릭 시 `data-type` 아닌 카드 숨김, JS 꺼져 있으면 전부 보임)

- [ ] **Step 1:** `/archive`: `sortByDate(publicOnly(all))`를 연도별로 묶은 타임라인 + TypeFilter.
- [ ] **Step 2:** `/portfolio`: `featured && public` 카드 그리드. `/portfolio/[slug]`: `getStaticPaths`는 **공개 항목 전부**(featured만이 아님 — 아카이브에서도 상세로 들어감), 본문 렌더, `metrics`·`links`·`attachments`(이미지는 `<img>`, PDF는 링크). 본문의 `## 자소서 재료` 섹션은 렌더에서 제외(렌더 전 마크다운에서 해당 헤딩부터 다음 `## `까지 잘라냄).
- [ ] **Step 3:** Run `npm run build` → `dist/portfolio/`에 비공개 샘플 항목 slug 폴더가 없는지 `ls`로 확인.
- [ ] **Step 4: Commit** `feat: 아카이브·포트폴리오 페이지`

---

### Task 5: 이력서·맞춤 이력서·지원 페이지

**Files:**
- Create: `src/lib/resume.ts`, `src/styles/print.css`, `src/pages/resume/index.astro`, `src/pages/resume/[app].astro`, `src/pages/apply/index.astro`, `src/pages/apply/[app].astro`
- Test: `tests/resume.test.ts`

**Interfaces:**
- Consumes: `groupByType`, `publicOnly`, collections `applications`, `essays`
- Produces: `tailoredEntries<T extends EntryLike>(all: T[], matches: {entry:string; score:number}[]): T[]` — 공개 항목 중 matches에 있는 것만, score 내림차순, 없는 id는 무시

- [ ] **Step 1: Write the failing test**
```ts
test('맞춤 이력서는 비공개·없는 id 제외, 점수순', () => {
  const all = [e('a','project','2026-01-01'), e('b','award','2026-02-01', false), e('c','career','2025-01-01')];
  const r = tailoredEntries(all, [{entry:'c',score:60},{entry:'b',score:99},{entry:'zzz',score:90},{entry:'a',score:80}]);
  expect(r.map(x => x.id)).toEqual(['a','c']);
});
```
- [ ] **Step 2:** Run → FAIL. 구현 → PASS.
- [ ] **Step 3:** `/resume`: 상단 이름·연락처·링크, `groupByType(publicOnly(all))` 섹션마다 `기간 | 제목 · org | summary`. `/resume/[app]`: 같은 레이아웃, `groupByType(tailoredEntries(...))`, 상단에 "○○ ○○직 지원용". `print.css`(`@media print`): `@page{size:A4;margin:16mm}`, 흰 배경 검정 글자로 강제(개인 색 무시), Nav·버튼 숨김, 섹션 중간 `break-inside: avoid`. 화면에 `PDF로 저장` 버튼(`window.print()`).
- [ ] **Step 4:** `/apply`: 지원 건 목록(회사·직무·마감일). `/apply/[app]`: requirements, matches(항목 링크·점수 막대·근거 — 비공개 항목은 "비공개 항목"으로만 표시), gaps, 맞춤 이력서 링크, 자소서 초안들(문항·글자 수·본문).
- [ ] **Step 5:** `npm run build`. 크롬으로 `/resume` 인쇄 미리보기 확인(A4 2쪽 이내, 잘림 없음).
- [ ] **Step 6: Commit** `feat: 이력서·맞춤 이력서·지원 페이지`

---

### Task 6: 관리 페이지 + 메모 패널 + 이슈 URL

**Files:**
- Create: `src/lib/issue.ts`, `src/lib/memo.ts`, `src/components/MemoPanel.astro`, `src/pages/manage/index.astro`
- Test: `tests/issue.test.ts`, `tests/memo.test.ts`

**Interfaces:**
- Consumes: `Profile.repo`, `sortByDate`, `TypeFilter`, `EntryCard`
- Produces:
  - `issueUrl(repo: string, o: { label: 'archive'|'job'|'essay'|'memo'; title: string; body: string }): string` — `https://github.com/<repo>/issues/new?labels=…&title=…&body=…`, 전체 길이 8000자 이하가 되도록 body를 자르고 끝에 `\n\n(메모가 길어서 잘렸어요. 나머지는 이 아래에 붙여 넣어 주세요.)` 추가.
  - `memoStore(storage: Storage | null): { ok: boolean; get(id: string): string; set(id: string, text: string): void }` — 키 `memo:<id>`, storage가 null이거나 접근이 throw하면 `ok:false`, get은 `''`, set은 무시.

- [ ] **Step 1: Write the failing tests**
```ts
test('라벨·제목·본문 인코딩', () => {
  const u = new URL(issueUrl('a/b', { label:'memo', title:'[메모] 해커톤', body:'팀장 함' }));
  expect(u.pathname).toBe('/a/b/issues/new');
  expect(u.searchParams.get('labels')).toBe('memo'); expect(u.searchParams.get('body')).toBe('팀장 함');
});
test('긴 본문은 8000자 안으로 자르고 안내', () => {
  const u = issueUrl('a/b', { label:'memo', title:'t', body:'가'.repeat(20000) });
  expect(u.length).toBeLessThanOrEqual(8000);
  expect(new URL(u).searchParams.get('body')).toContain('잘렸어요');
});
test('storage 접근이 throw해도 죽지 않음', () => {
  const bad = { getItem(){ throw new Error('blocked') }, setItem(){ throw new Error('blocked') } } as unknown as Storage;
  const m = memoStore(bad);
  expect(m.ok).toBe(false); expect(m.get('x')).toBe(''); expect(() => m.set('x','y')).not.toThrow();
});
test('저장·읽기', () => {
  const s = new Map<string,string>();
  const m = memoStore({ getItem:k => s.get(k) ?? null, setItem:(k,v) => void s.set(k,v) } as unknown as Storage);
  m.set('a','메모'); expect(m.get('a')).toBe('메모'); expect(s.get('memo:a')).toBe('메모');
});
```
- [ ] **Step 2:** Run → FAIL. 구현 → PASS. 자르기는 인코딩 후 길이를 보고 이분 탐색이나 반복으로 body 글자 수를 줄인다(멀티바이트 인코딩 때문에 글자 수 ≠ URL 길이).
- [ ] **Step 3:** `/manage`(`noindex`): 비공개 포함 **전체** 항목 목록 + TypeFilter + 상단 버튼 `+ 기록하기`(label archive, 본문은 `.github/ISSUE_TEMPLATE/archive.yml` 안내문과 같은 틀) · `공고 분석`(job) · `자소서 쓰기`(essay). 비공개 항목에는 `비공개` 배지.
- [ ] **Step 4:** `MemoPanel.astro`: 항목 클릭 → 오른쪽 패널(폭 `min(420px, 100vw)`, 모바일은 전체 폭). `motion`의 `animate(panel, {x:['100%',0]}, {type:'spring', bounce:0, duration:0.4})`, 닫을 때 같은 경로로 `x:'100%'`. 애니메이션 중에도 다시 클릭하면 현재 위치에서 방향 전환(motion이 현재 값에서 시작). 스크림 없음, 목록은 계속 조작 가능. Esc·닫기 버튼으로 닫힘, 열릴 때 textarea에 포커스, 닫히면 원래 항목으로 포커스 복귀. 내용: 항목 제목·종류, textarea(입력 300ms 디바운스 저장, `memoStore.ok`가 false면 "이 브라우저에는 저장할 수 없어요. 보내기 전에 내용을 복사해 두세요" 안내), `AI에게 보내기` 버튼 → `issueUrl(repo, {label:'memo', title:'[메모] '+제목, body:'항목: content/entries/<id>.md\n\n'+메모})`를 새 탭으로. reduced-motion이면 opacity 전환만.
- [ ] **Step 5:** `npm run build && npx astro preview` → 패널 열기/닫기/메모 저장/새로고침 후 유지/보내기 URL 확인.
- [ ] **Step 6: Commit** `feat: 관리 페이지와 메모 패널`

---

### Task 7: PWA + 배포 + 학생용 README

**Files:**
- Modify: `astro.config.mjs`
- Create: `.github/workflows/deploy.yml`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `README.md`(덮어씀)
- Test: `tests/base-path.test.ts`

**Interfaces:**
- Produces: `deploy.yml`은 `on: push(main)` + `workflow_dispatch` + `workflow_call`(Task 8이 호출).

- [ ] **Step 1:** `astro.config.mjs`: `base: process.env.BASE_PATH ?? '/'`, `site: process.env.SITE_URL`, `@vite-pwa/astro` 통합 — `registerType:'autoUpdate'`, manifest `{name: profile.name.ko+' 아카이브', short_name: profile.monogram, start_url: base, scope: base, display:'standalone', background_color/theme_color: profile.theme.bg, icons: 192/512}`, workbox `navigateFallback` 없음(방문한 페이지만 오프라인).
- [ ] **Step 2: Write the failing test** `tests/base-path.test.ts` — `execSync('npm run build', {env:{...process.env, BASE_PATH:'/other/'}})` 후 `dist/**/*.html`에서 `href="/`·`src="/` 중 `/other/`로 시작하지 않는 것이 0개, `dist/manifest.webmanifest`의 `start_url`이 `/other/`. (느리니 `test.skipIf(!process.env.FULL)`로 두고 `FULL=1 npm test`로 실행)
- [ ] **Step 3:** Run `FULL=1 npm test` → 하드코딩 링크가 있으면 FAIL → `withBase`로 고쳐 PASS.
- [ ] **Step 4:** `deploy.yml`: `actions/checkout` → `actions/configure-pages`(id pages) → `withastro/action`(env `BASE_PATH: ${{ steps.pages.outputs.base_path }}/`, `SITE_URL: ${{ steps.pages.outputs.origin }}`) → `actions/deploy-pages`. permissions `pages: write, id-token: write, contents: read`. 각 액션은 현재 최신 메이저 태그를 확인해 고정.
- [ ] **Step 5:** README(학생용, 한국어): ① Use this template ② Settings → Pages → Source: GitHub Actions ③ `profile.yml` 고치기(이름·색·폰트·repo) ④ https://github.com/apps/claude 설치 ⑤ 로컬에서 `claude setup-token` → 저장소 Secret `CLAUDE_CODE_OAUTH_TOKEN` ⑥ 라벨 `archive job essay memo` 만들기(`gh label create` 명령 4줄) ⑦ 공개 저장소면 `public:false`도 소스에선 보인다는 경고와 비공개 저장소 권장 ⑧ 로컬 사용: 폴더에서 `claude` 실행 후 "이 메모 기록해줘" 등.
- [ ] **Step 6:** 아이콘은 모노그램을 배경색 위 포인트색 글자로 그린 PNG 두 장(빌드 스크립트 없이 한 번 생성해 커밋).
- [ ] **Step 7: Commit** `feat: PWA·Pages 배포·학생용 README`. 푸시 후 Pages 배포는 사용자 확인 뒤 진행.

---

### Task 8: AI 자동화 (스킬 3개 + 이슈 템플릿 + 워크플로)

**Files:**
- Create: `CLAUDE.md`, `.claude/skills/archive/SKILL.md`, `.claude/skills/job-analysis/SKILL.md`, `.claude/skills/essay/SKILL.md`, `.github/ISSUE_TEMPLATE/archive.yml`, `job.yml`, `essay.yml`, `memo.yml`, `.github/workflows/ai.yml`

**Interfaces:**
- Consumes: `entrySchema`·`applicationSchema`·`essaySchema` 필드(Task 1), `deploy.yml`의 `workflow_call`(Task 7), 라벨 `archive job essay memo`(Task 6 issueUrl과 동일)

- [ ] **Step 1:** `CLAUDE.md`: 저장소 목적 3줄, 항목·지원 건 파일 위치와 frontmatter 필드 목록(Task 1 Interfaces 그대로), 규칙 — 사실 날조 금지(모르면 필드 비우고 질문 목록에), slug는 `YYYY-MM-<영문-kebab>`, 첨부는 `public/archive/<slug>/`, 작업 후 `npm run build`가 통과해야 함, 한 이슈 = 한 커밋, 커밋 메시지 `archive: <제목>` 형식.
- [ ] **Step 2:** 스킬 3개 (`name`, `description` frontmatter + 절차). 각 스킬은 입력이 이슈 본문이든 대화든 같은 절차:
  - **archive**: 재료(메모·링크·첨부) 읽기 → 링크가 GitHub 저장소면 README 읽기 → 기존 항목과 같은 활동이면 새로 만들지 말고 보강 → 항목 작성 → 필수 정보(date, role) 없으면 질문 목록 출력. 라벨 `memo`면 지정된 항목 파일의 본문·`## 자소서 재료`에 메모 내용만 보강.
  - **job-analysis**: 공고 읽기 → requirements(5~10개) → 모든 항목(비공개 포함 읽기는 가능) 대비 matches(score 0~100, reason 1문장, 공개 항목 우선) → gaps → `content/applications/<회사-직무 slug>/index.md` 작성 → 공고에 자소서 문항이 있으면 essay 스킬 절차로 이어감.
  - **essay**: 문항·지원처·글자 수 → 관련 항목 2~3개 제시 → 부족한 점 3~5개 질문 → (Action에서는 질문을 이슈 댓글로 남기고 종료, 답 댓글이 달리면 재실행) → 초안 `essay-<n>.md`, 글자 수는 공백 포함으로 세어 limit의 90~100% → 받은 답을 각 항목 `## 자소서 재료`에 날짜와 함께 추가.
- [ ] **Step 3:** 이슈 템플릿 4개(issue forms YAML, `labels:` 자동 지정): archive(메모 textarea, 링크, 첨부 안내), job(공고 텍스트/링크, 지원 직무), essay(지원처, 문항, 글자 수), memo(항목 경로, 메모).
- [ ] **Step 4:** `ai.yml`:
  - `on: issues: [opened]`(labeled는 넣지 않음 — 라벨 붙은 채 열린 이슈가 opened+labeled로 두 번 돌기 때문), `issue_comment: [created]`(이슈 작성자 본인 댓글이고 라벨 essay/archive인 경우만 — 되묻기 답변용). `concurrency: ai-${{ github.event.issue.number }}`.
  - job `run`: permissions `contents: write, issues: write, pull-requests: write, id-token: write`. checkout → `actions/setup-node`(22) + `npm ci` → `anthropics/claude-code-action@v1` with `claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}`, `prompt`: "이슈 #N의 라벨(<labels>)에 맞는 `.claude/skills/<skill>/SKILL.md` 절차를 따르라. 끝나면 `npm run build`를 실행하고 통과할 때만 커밋하라", `claude_args: --allowedTools "Read,Write,Edit,Glob,Grep,WebFetch,Bash(npm run build),Bash(git add:*),Bash(git commit:*),Bash(git push:*)"`.
  - 다음 step(액션이 만든 브랜치 이름은 액션 출력 `branch_name`을 쓰고, 출력이 없으면 `claude/issue-<N>` 패턴으로 `git ls-remote` 조회): 그 브랜치 checkout → `npm ci && npm run build` → 성공이면 `git checkout main && git merge --ff-only <branch> || git merge --no-edit <branch>` → `git push origin main` → 브랜치 삭제 → `gh issue comment N --body "기록했어요: <사이트 URL>"`. 실패면 `gh issue comment N --body "빌드가 실패해서 반영하지 않았어요: <로그 링크>"`, main은 건드리지 않음.
  - job `deploy`: `needs: run`, `if: needs.run.outputs.merged == 'true'`, `uses: ./.github/workflows/deploy.yml`(GITHUB_TOKEN 푸시는 다른 워크플로를 트리거하지 않으므로 직접 호출).
- [ ] **Step 5: 로컬 검증** — `claude -p "content/entries 에 다음 메모를 기록해줘: 2026-10 DGIST 메이커톤 참가, 팀장, AI 아카이빙 템플릿 제작" --allowedTools Read,Write,Edit,Glob,Grep,"Bash(npm run build)"` → 새 항목 생성, 날조 없음(수상·수치 없음), `npm run build` 통과 확인. 결과 파일은 지우거나 샘플로 남길지 사용자에게 묻는다.
- [ ] **Step 6: Commit** `feat: Claude Code 스킬·이슈 템플릿·AI 워크플로`
- [ ] **Step 7: GitHub 검증(사용자 승인 후)** — 사용자가 Claude App 설치·Secret 등록을 마치면 푸시하고 테스트 이슈 3개(archive / job / 일부러 날짜 없는 archive)를 올린다. 확인: ① 항목이 main에 들어가고 사이트에 보임 ② job 이슈로 `/apply/<slug>`, `/resume/<slug>` 생성 ③ 날짜 없는 이슈엔 되묻는 댓글. `label_trigger`·쓰기 권한 체크 동작이 문서와 다르면 워크플로 조건을 고친다.
