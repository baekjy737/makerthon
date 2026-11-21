# Apply·Recommend 재구성 Implementation Plan (Task 14~21)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** APPLY = 모집 공고 + 지원서 작성, RECOMMEND = 연구실 탐색 + 다음 공부로 나누고, 아카이브 분류·파일 올리기와 링크드인·리멤버 내보내기를 더한다.

**Architecture:** 정적 Astro 사이트에 콘텐츠 컬렉션 `openings`를 하나 더하고, AI 처리는 기존 `ai.yml`(이슈 → Claude → files 출력 → PR)과 주간 cron 워크플로로 한다. 사이트에서는 AI를 직접 부르지 않는다. 선택·편집은 미리 만든 데이터와 localStorage로만 한다.

**Tech Stack:** Astro 5, TypeScript, zod(astro:content), motion, vitest, GitHub Actions + Claude Code Action

**Spec:** `docs/superpowers/specs/2026-11-21-apply-recommend-design.md`

## Global Constraints

- 새 npm 의존성을 추가하지 않는다.
- 모든 내부 링크는 `withBase`를 거친다. 이슈 버튼 URL은 `issueUrl(profile.repo, …)`를 쓴다.
- 비공개 항목(`public: false`)은 공고·지원·추천 화면과 공개 산출물에 나오지 않는다.
- 상태 문구는 `모집 중` · `마감` · `확인 필요`로 정확히 쓴다.
- 공고 유형 라벨: `lab-intern` 대학원 연구실 인턴 · `undergrad-research` 연구과제 학부연구생 · `company-intern` 기업 인턴 · `company-job` 기업 채용
- UI Task는 시작 전에 `.claude/skills/apple-design/SKILL.md`를 읽는다. 페이지 스타일은 각 파일 `<style>` 안에 둔다.
- 각 PR은 `npm test`와 `npm run build`를 통과해야 한다.

## Review Focus

- 마감일이 없는 공고와 `verified: false` 공고는 `확인 필요`여야 하고, 절대 `모집 중`이면 안 된다(T15 테스트).
- 시작일이 미래인 공고는 `확인 필요`여야 한다. 아직 접수 전이기 때문이다(T15 테스트).
- localStorage를 쓸 수 없는 브라우저(사생활 보호 모드)에서도 지원서 초안 화면이 깨지지 않아야 한다. MemoPanel의 `MemoStore`처럼 실패를 안내한다(T19).
- `interests`가 비어 있으면 연구실 탐색은 빈 목록이 아니라 전체 목록을 보여야 한다(T20 테스트).
- 이슈 URL이 너무 길면(편집본이 긴 초안) `MAX_ISSUE_URL`을 넘지 않게 잘라야 한다. 기존 `issueUrl`의 자르기를 그대로 쓴다(T19).

## 배정과 순서

| Task | 담당 | 시작 조건 |
|---|---|---|
| 14 아카이브 정리·파일 올리기·RECOMMEND 뼈대 | Claude-1 | 지금 |
| 15 스키마·공고 데이터·샘플 | Claude-2 | 지금 |
| 16 공고 수집 AI(이슈·주간 워크플로) | GPT-1 | Task 15 병합 후 (스킬 문서는 지금) |
| 17 지원서 양식·추천 스킬 확장 | AGY-1 | Task 15 병합 후 (스킬 문서는 지금) |
| 18 APPLY 모집 공고 보드 | Claude-3 | Task 14·15 병합 후 |
| 19 지원서 작성 화면 | Claude-4 | Task 15 병합 후 |
| 20 RECOMMEND 화면 | GPT-2 | Task 14·15 병합 후 |
| 21 링크드인·리멤버 내보내기 | Claude-2 | Task 15 끝난 뒤 |

---

### Task 14: 아카이브 정리·파일 올리기·RECOMMEND 뼈대 (Claude-1)

**Files:** Modify `src/components/EntryCard.astro`, `src/components/TypeFilter.astro`, `src/pages/archive/index.astro`, `src/pages/portfolio/[slug].astro`, `src/components/MemoPanel.astro`, `src/components/Nav.astro`, `src/pages/apply/index.astro` / Create `src/pages/recommend/index.astro`

**Produces:** 메뉴 `{ href: '/recommend', label: 'RECOMMEND' }`(APPLY 앞). `/recommend`는 `RecommendPreview`와 [추천 받기] 버튼만 있는 뼈대이고, Task 20이 이 파일을 넘겨받는다. 아카이브 카드 링크는 `/portfolio/<id>/?from=archive`이다.

- [ ] `.entry-card[hidden] { display: none; }`를 넣는다. TypeFilter는 보이는 카드가 0개인 `.year` 묶음에 `hidden`을 붙인다.
- [ ] 공부 기록 탭에 소제목 `연구`(research, paper)와 `공부`(course, study)를 두고, 그 안을 주제별로 묶는다. `research`는 활동 탭에서 뺀다.
- [ ] 상세 페이지: `?from=archive`이면 돌아가기 링크를 `← 아카이브`(`withBase('/archive')`)로 바꾼다. 작은 인라인 스크립트로 처리한다.
- [ ] 아카이브 머리말에 [파일 올려 기록하기](`archive` 이슈)를 둔다. MemoPanel에는 [이 항목에 파일 추가](`memo` 이슈, 제목 `[메모] <항목 ID>`)를 둔다.
- [ ] APPLY에서 추천 미리보기와 [추천 받기]를 빼서 `/recommend`로 옮긴다.
- [ ] 확인: preview에서 필터를 눌렀을 때 카드와 빈 연도가 사라지는지, 아카이브 → 상세 → 아카이브로 돌아오는지 본다.

### Task 15: 스키마·공고 데이터·샘플 (Claude-2)

**Files:** Modify `src/lib/schema.ts`, `src/content.config.ts` / Create `src/lib/openings.ts`, `content/openings/2026-11-sample-lab-intern.md`, `content/openings/2026-11-sample-undergrad.md`, `tests/openings.test.ts` / Modify sample `content/applications/sample-company/essay-*.md`, `content/next/*.md`, `tests/schema.test.ts`

**Produces:**
- `OPENING_KINDS = ['lab-intern','undergrad-research','company-intern','company-job'] as const`, `OPENING_LABELS: Record<OpeningKind,string>`
- `openingSchema`(`content/openings/<slug>.md` frontmatter): `kind`, `org: string`, `title: string`, `url: string().url()`, `verified: boolean default false`, `target?: string`(모집 대상), `eligibility?: string`, `start?: date`, `deadline?: date`, `tags: string[] default []`, `lab?: string`(labs.json `id`), `created: date`. 본문 = 공고 요약
- `type Opening = { id: string; kind: OpeningKind; org: string; title: string; url: string; verified: boolean; target?: string; eligibility?: string; start?: Date; deadline?: Date; tags: string[]; lab?: string }`
- `openingStatus(o: Opening, now: Date): 'open' | 'closed' | 'unverified'`
- `fromIntern(i: Intern): Opening` (`data/interns.json` 한 건 → `company-intern`. `id`는 `intern-<INT-id>`)
- `fromResearchProgram(p: ResearchProgram): Opening` (`data/research-internships.json` `programs` 한 건 → `lab-intern`. `id`는 `rp-<id>`, `verified`는 `deadline`이 있을 때만 true, `target`은 `crossSchool`과 `eligibility`, `start`는 `YYYY-MM`이면 그 달 1일)
- `type ResearchProgram`, `type ResearchTopic`은 `research-internships.json`의 필드 그대로다(`deadline?`, `deadlineText?` 등 선택 필드는 없을 수 있다)
- `loadOpenings(collection: CollectionEntry<'openings'>[], interns: Intern[], programs: ResearchProgram[]): Opening[]` (마감일 오름차순, 마감일 없는 건 뒤로)
- `essaySchema`에 `materials: {entry: string, reason: string, draft: string}[] default []`, `checks: string[] default []` 추가
- `nextSchema`에 `actions: string[] default []`(바로 해볼 공부) 추가

- [ ] `tests/openings.test.ts`
  - `verified && start<=now<=deadline`이면 `open`
  - `deadline<now`이면 `closed`(verified와 관계없이)
  - deadline 없음, `verified:false`, start 미래이면 `unverified`
  - `fromIntern`이 `INT-0016` 예시를 `company-intern`으로 매핑하고 `eligibility`를 옮김
  - `fromResearchProgram`이 `RP26-001`(POSTECH 기계공학과 동계 연구인턴, 마감 2026-11-22)을 `lab-intern`·`verified: true`로 매핑하고, 마감일이 없는 공고는 `verified: false`로 매핑함
  - `loadOpenings`의 정렬
- [ ] 실패를 확인한 뒤 구현하고 통과시킨다. 샘플 essay에 `materials`(공개 항목 ID 2개, 각 초안) 하나와 `checks`를, 샘플 next에 `actions`를 채운다.
- [ ] `CLAUDE.md` 콘텐츠 형식 표에 `content/openings/<slug>.md` 줄과 essay `materials`·`checks`, next `actions`를 추가한다(Task 8 소유 파일이지만 스키마와 같이 바뀌어야 하므로 이 Task에 둔다).

### Task 16: 공고 수집 AI (GPT-1)

**Files:** Create `.github/ISSUE_TEMPLATE/opening.yml`, `.claude/skills/opening/SKILL.md`, `.github/workflows/collect-openings.yml` / Modify `.github/workflows/ai.yml`, `README.md`(라벨 표)

**Consumes:** Task 15 `openingSchema`

- [ ] `opening` 이슈 템플릿: 공고 URL(필수), 유형(드롭다운 4개, 선택), 메모.
- [ ] `opening` 스킬: 원문을 읽어 `content/openings/<YYYY-MM>-<기관-영문-kebab>.md`를 쓴다. 접수 기간을 원문에서 확인했을 때만 `verified: true`로 쓰고, 확인하지 못한 필드는 생략한다. `labs.json`의 연구실과 같으면 `lab`을 채운다.
- [ ] `ai.yml`에 `opening` 라우트를 추가한다(작성자 권한 조건은 기존과 같다).
- [ ] `collect-openings.yml`: `schedule`(주 1회, 월 09:00 KST)과 `workflow_dispatch`. 출처 목록(링커리어 인턴, DGIST 학부연구생·UGRP 공지, `labs.json` 연구실 홈페이지의 인턴 공지)을 돌며 같은 스킬로 새 공고만 추가한다. 이미 있는 `url`은 건너뛴다. 결과는 PR → 빌드 통과 시 병합하고, 병합 후 `gh workflow run deploy.yml --ref main`을 실행한다. 이건 `ai.yml`과 같은 방식이다.
- [ ] 확인: 샘플 URL 하나로 이슈 흐름을 dry-run해서 frontmatter가 `openingSchema`를 통과하는지 본다.

### Task 17: 지원서 양식·추천 스킬 확장 (AGY-1)

**Files:** Modify `.github/ISSUE_TEMPLATE/essay.yml`, `.claude/skills/essay/SKILL.md`, `.claude/skills/recommend/SKILL.md`

**Consumes:** Task 15 essay `materials`·`checks`, next `actions`

- [ ] `essay.yml`: "지원서 양식 파일(PDF·이미지) 또는 문항 원문" 칸(첨부 가능)과 지원처를 둔다. 문항 하나 대신 양식 전체를 받을 수 있게 한다.
- [ ] essay 스킬
  - 첨부·본문에서 문항과 글자 수를 추출해 문항마다 `essay-<n>.md`를 쓴다.
  - 공개 항목에서 소재 2~3개를 골라 `materials[{entry, reason, draft}]`를 채운다. `draft`는 글자 수 제한 안에서 쓴다.
  - 기록에 없는 개인 기여·성과는 지어내지 않고 `checks`에 적는다.
  - 본문은 가장 추천하는 소재의 초안이다.
- [ ] recommend 스킬: next에 `actions`(바로 해볼 공부·탐구, 구체적인 행동 하나씩)를 쓰게 한다. 예시 순서: "DNA 복제 포크 구조 복습 → 복제 스트레스 개념 정리 → 읽은 논문 그림 하나 다시 설명해 보기".
- [ ] 확인: 샘플 양식 텍스트로 스킬을 돌린 출력이 `essaySchema`를 통과하는지 본다(`npm run build`).

### Task 18: APPLY 모집 공고 보드 (Claude-3)

**Files:** Modify `src/pages/apply/index.astro` / Create `src/components/OpeningCard.astro`

**Consumes:** Task 15 `loadOpenings`, `openingStatus`, `OPENING_LABELS`

- [ ] APPLY 순서: 머리말 → 이슈 버튼(기록하기 · 공고 추가 · 지원서 올리기) → **모집 중인 기회**(유형 4개 탭 + "모집 중만 보기" 토글) → **내 지원서**(지원 건 목록).
  - 탭 마크업과 스크립트는 `archive/index.astro`의 tablist를 따른다.
  - [공고 추가]는 `opening` 이슈, [지원서 올리기]는 `essay` 이슈를 연다.
- [ ] `OpeningCard`: 기관·제목, 상태 배지, 모집 대상, 자격 요건, 마감일(`YYYY-MM-DD`, D-n), 원본 공고 링크(새 탭). `lab`이 있으면 `id="opening-<id>"` 앵커를 둔다(Task 20이 링크한다).
- [ ] 확인: 121건 + 샘플로 빌드해서 탭 전환, 토글, 마감 배지를 본다.

### Task 19: 지원서 작성 화면 (Claude-4)

**Files:** Modify `src/pages/apply/[app].astro` / Create `src/components/EssayWorkspace.astro`

**Consumes:** Task 15 essay `materials`·`checks`

- [ ] 문항마다 다음 순서로 보인다.
  - 문항과 글자 수 제한
  - **추천 소재** 라디오 카드: 항목 제목, 추천 이유, 원본 링크 `withBase('/portfolio/<entry>/')`. 비공개 항목은 링크 없이 제목만 보인다.
  - **초안** textarea: 글자 수 카운터, 제한을 넘으면 경고.
  - **확인할 항목** 목록
- [ ] 소재를 바꾸면 그 소재의 `draft`를 편집 칸에 넣는다. 사용자가 이미 고친 편집본이 있으면 덮어쓰기 전에 확인한다. 편집본은 `localStorage['essay:<app>/<n>:<entry>']`에 둔다. 저장에 실패하면 MemoPanel처럼 경고를 보인다.
- [ ] [다듬기 요청]: 문항·선택 소재·편집본을 담아 `essay` 이슈 URL(`issueUrl`)을 연다.
- [ ] 머리말에 맞춤 이력서 `/resume/<app>/` 링크를 둔다.
- [ ] 확인: preview에서 소재 전환, 편집 유지(새로고침), 글자 수 초과 경고, 이슈 URL 길이를 본다.

### Task 20: RECOMMEND 화면 (GPT-2)

**Files:** Modify `src/pages/recommend/index.astro` / Create `src/lib/labMatch.ts`, `tests/labMatch.test.ts`, `src/components/LabCard.astro`

**Consumes:** Task 14 `/recommend` 뼈대, Task 15 `loadOpenings`·`openingStatus`·next `actions`

- [ ] 연구실 탐색 대상은 DGIST `labs.json`과 `research-internships.json` `topics`(타 기관, 연구실·교수·주제·분야·원문 링크)다. 기관 필터(DGIST / 그 외 기관명)를 둔다.
- [ ] `matchTopics(topics: ResearchTopic[], interests: string[])`도 `matchLabs`와 같은 규칙으로 `topic`·`category`·`lab`·`division`을 본다.
- [ ] `matchLabs(labs: Lab[], interests: string[]): { lab: Lab; hits: string[] }[]`
  - `summary`·`internTopics`·`dept`에서 관심사 키워드가 맞은 주제를 `hits`로 돌려준다.
  - hits 수 내림차순으로 정렬한다.
  - interests가 비면 전체를 hits `[]`로 돌려준다.
  - 테스트: 정렬, 빈 interests, 대소문자·공백 무시
- [ ] 화면 순서: 머리말 + [추천 받기] → **다음 공부**(next 카드, `learned → next → actions` 3단 흐름) → **AI 추천 연구실·기회**(matches) → **연구실 탐색**(LabCard, 관심사 칩 필터, 맞은 주제 강조).
  - 열린 공고(`openingStatus==='open'`이고 `lab===lab.id`)가 있으면 `withBase('/apply/#opening-<id>')`로 링크한다.
- [ ] 기존 `/next`·`/match` 상세 페이지 링크는 유지한다.

### Task 21: 링크드인·리멤버 내보내기 (Claude-2)

**Files:** Create `src/lib/linkedin.ts`, `tests/linkedin.test.ts`, `src/components/CopyButton.astro` / Modify `src/pages/portfolio/[slug].astro`, `src/components/ResumeDocument.astro`

- [ ] `linkedinText(entry: EntryData): string`
  - 종류별 입력 칸 순서로 만든다. career·activity는 직함/회사/기간/설명, project, award, certificate.
  - 설명은 summary, metrics, 태그로 만든다.
- [ ] `linkedinCertUrl(entry): string | undefined`: certificate만 만든다. 사양의 `profile/add` 파라미터를 `encodeURIComponent`한다.
- [ ] `rememberText(entries): string`: 경력·학력·활동을 리멤버 경력 입력 순서로 만든다.
- [ ] 테스트: 종류별 문구, 인코딩, 비공개 항목 제외(rememberText)
- [ ] 상세 페이지에 [링크드인용 복사], certificate면 [링크드인 프로필에 추가], 그리고 [링크드인에 공유](`share-offsite`)를 둔다. 이력서에 [리멤버 경력용 복사]를 둔다(인쇄 시 숨김). `profile.links`의 LinkedIn·Remember는 기존 링크 렌더링을 그대로 쓴다.
