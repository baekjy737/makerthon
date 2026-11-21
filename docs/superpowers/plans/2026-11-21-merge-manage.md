# 관리 탭 통합 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 흩어진 화면을 합친다. 메인 = 히어로 + 포트폴리오, 상세 페이지에서 메모·편집, 아카이브 = [활동 | 공부 기록] 탭, 지원 = 이슈 버튼 + 지원 목록 + 추천. `/manage`는 없앤다.

**Architecture:** 새 모듈 없이 기존 컴포넌트를 옮긴다. `MemoPanel`은 `[data-memo-open]` 버튼과 `<template data-entry-preview>`만 있으면 어느 페이지에서나 열리므로 상세 페이지에 그대로 붙인다. 아카이브 탭은 `StudyTabs`의 tablist 마크업·스크립트·스타일을 옮겨 쓰고, `StudyTabs`·`DetailPanel`은 지운다.

**Tech Stack:** Astro 5, TypeScript, motion, vitest

**Spec:** 이 대화에서 합의한 Q1~Q13 (아래 Global Constraints에 정리)

## Global Constraints

- `/portfolio` 목록 페이지와 메뉴 PORTFOLIO는 유지한다.
- 메인 순서: Hero(+StatStrip) → 바로가기 줄 → 포트폴리오 그리드(공개 + `featured`) → "전체 아카이브 보기".
- 상세 페이지 "메모·편집" 버튼은 누구에게나 보인다(데모). 메모 미리보기 본문은 `자소서 재료`를 뺀 `safeEntry` 본문이다.
- 아카이브 탭: `활동`(STUDY_TYPES 제외, 기존 타임라인 + TypeFilter) | `공부 기록`(STUDY_TYPES, `groupByTopic`, 카드 → 상세 페이지). 처음 선택은 활동이다.
- 지원 페이지 순서: 이슈 버튼(기록하기 · 공고 분석 · 자소서 쓰기 · 추천 받기) → 지원 목록 → `RecommendPreview`.
- 비공개 항목은 사이트 어디에도 렌더하지 않는다.
- 새 의존성을 추가하지 않는다.

## Review Focus

- 공부 기록이 0개인 저장소: 공부 탭에 빈 안내 문구가 보이고, 활동 탭은 정상이어야 한다.
- 아카이브 TypeFilter: 활동 탭 안의 카드만 세고 숨겨야 한다(`data-filter-scope`를 활동 패널로 좁힌다).
- `BASE_PATH=/other` 빌드: 새 링크(포트폴리오 그리드, 이슈 버튼, 추천)가 모두 `withBase`를 거쳐야 한다.
- 상세 페이지 HTML에 `자소서 재료` 섹션이 들어가지 않아야 한다(빌드 산출물 grep).
- 첨부 폴더 `public/archive/<id>/`의 파일도 메모 대상 파일 목록에 들어가야 한다(관리 탭의 `filesOf` 그대로).

---

### Task 1: 메인 = 히어로 + 포트폴리오

**Files:** Modify `src/pages/index.astro` / Delete `src/components/StudyTabs.astro`, `src/components/DetailPanel.astro`

- [ ] StudyTabs·DetailPanel·RecommendPreview와 공부·활동 데이터 계산을 지운다.
- [ ] 바로가기 줄 아래에 `<section id="portfolio">`를 둔다. `portfolio/index.astro`처럼 `EntryCard` 2열 그리드와 아카이브 링크를 쓴다.

### Task 2: 상세 페이지에 메모 패널

**Files:** Modify `src/pages/portfolio/[slug].astro`

- [ ] 관리 탭의 `filesOf(e): MemoFile[]`를 옮긴다(본문 Markdown + attachments + 첨부 폴더 + links).
- [ ] 머리말 meta 줄에 `data-memo-open` 버튼(`data-id`·`data-title`·`data-type-label`·`data-path`·`data-files`)을 둔다.
- [ ] `<template data-entry-preview={entry.id}>`에는 `<Content />`(걸러진 본문)를 넣고, `<MemoPanel repo={profile.repo} />`를 붙인다.

### Task 3: 아카이브 탭

**Files:** Modify `src/pages/archive/index.astro`

- [ ] StudyTabs의 tablist·스크립트·스타일을 옮긴다. 탭은 `activity` | `study`, 처음 선택은 activity다.
- [ ] 활동 패널에 `data-filter-scope`, TypeFilter, 기존 연도 타임라인(STUDY_TYPES 제외)을 둔다.
- [ ] 공부 패널은 `groupByTopic` 그룹마다 제목 + EntryCard 그리드다. 비었으면 안내 문구를 보인다.

### Task 4: 지원 페이지

**Files:** Modify `src/pages/apply/index.astro`

- [ ] 관리 탭의 `actions`(3개) + `recommend` 버튼을 옮긴다. 추천 버튼 본문은 `.github/ISSUE_TEMPLATE/recommend.yml`의 틀을 따른다.
- [ ] 지원 목록 아래에 `<RecommendPreview />`를 둔다.

### Task 5: 관리 탭 제거와 검증

**Files:** Delete `src/pages/manage/` / Modify `src/components/Nav.astro`, `docs/superpowers/specs/2026-11-21-archive-system-design.md`

- [ ] Nav에서 `/manage`를 지우고, 사양의 관리 줄을 "상세 페이지 메모 패널"로 고친다.
- [ ] `npm test`, `npm run build`, `BASE_PATH=/other npm run build`를 실행한다. `grep -r "자소서 재료" dist/portfolio`의 결과는 0줄이어야 한다.
- [ ] preview에서 메인 스크롤, 상세 페이지 메모 패널 열기·전체 화면, 아카이브 탭·필터, 지원 버튼을 확인한다.
- [ ] Commit, PR.
