# 공동작업 규칙 (개발용)

이 저장소는 여러 AI 에이전트가 함께 만든다. 작업 전에 이 파일과 아래 두 문서를 읽는다.

- 설계 사양: `docs/superpowers/specs/2026-11-21-archive-system-design.md`
- 구현 계획: `docs/superpowers/plans/2026-11-21-archive-system.md` (Task 1~8, Global Constraints, Review Focus)

> 이 파일은 개발 기간용이다. 템플릿을 배포하기 전에 리더가 지우거나 정리한다.

## 에이전트 번호

| 번호 | 도구 | 역할 |
|---|---|---|
| **Claude-1** | Claude Code | **리더.** PR 리뷰, main 병합, 충돌 해결, 이 배정표 관리. Task를 직접 맡지 않는다 |
| Claude-2 | Claude Code | 작업자 |
| Claude-3 | Claude Code | 작업자 |
| Claude-4 | Claude Code | 작업자 |
| GPT-1 | Codex | 작업자 |
| GPT-2 | Codex | 작업자 |
| GPT-3 | Codex | **디자인 개선 전담(고정).** 다른 Task는 맡지 않는다 |
| AGY-1 | Antigravity | 작업자 |

새 세션을 시작하면 사람이 "너는 GPT-2야"처럼 번호를 알려준다. 모르면 묻는다.

## 배정표

Task 1이 끝나야 대부분의 작업을 시작할 수 있다. 그래서 두 단계로 나눈다.

| Task | 담당 | 시작 조건 |
|---|---|---|
| 1 스캐폴드·스키마·샘플 데이터 | Claude-2 | 지금 시작 |
| 2 프로필·테마·기본 레이아웃 | Claude-2 | Task 1 병합 직후 이어서 |
| 8 AI 자동화(스킬·이슈 템플릿·워크플로) | GPT-1 | 지금 시작. 스키마 필드는 계획 Task 1 Interfaces를 그대로 쓰고, `deploy.yml`은 Task 7 Interfaces(`workflow_call`)대로 호출한다고 가정한다 |
| 7 PWA·배포·학생용 README | AGY-1 | Task 1 병합 후 |
| 3 히어로·기록 통계 | Claude-3 | Task 2 병합 후 |
| 6 관리 페이지·메모 패널·이슈 URL | Claude-4 | Task 2 병합 후 (`issue.ts`·`memo.ts`와 테스트는 Task 1 병합 후 먼저 시작해도 된다) |
| 4 아카이브·포트폴리오 | GPT-2 | Task 2 병합 후 |
| 5 이력서·맞춤 이력서·지원 | GPT-3 | Task 2 병합 후 (`resume.ts`와 테스트는 Task 1 병합 후 먼저 시작해도 된다) |

시작 조건이 안 됐으면 `git pull`로 main을 확인하고 기다린다. 앞 Task의 파일을 대신 만들지 않는다.

### 2단계: 공부 기록·추천 (Task 9~13)

- 사양은 `docs/superpowers/specs/2026-11-21-study-career-design.md`, 계획은 `docs/superpowers/plans/2026-11-21-study-career.md`(Task 9~13)다.
- 아래 표대로 배정한다. 담당이 막히거나 비면 리더가 다른 작업자(우선 GPT-2)에게 넘기고 표를 고친다. GPT-3은 디자인 개선만 맡는다.

| Task | 담당 | 시작 조건 |
|---|---|---|
| 9 외부 데이터 | AGY-1 | 지금. 참고 저장소 작성자 허락 받음(2026-11-21). `data/courses.json`은 #17로 병합됨 |
| 10 스키마·공부 기록·샘플 | Claude-2 | 지금 |
| 11 recommend 스킬·워크플로 | GPT-1 | 지금 |
| 12 메인 탭·오른쪽 패널·프로필 줄 | Claude-3 | Task 10 병합 후 |
| 13 추천 카드·상세·공부 계획 | Claude-4 | Task 10 병합 후 (`/match` 상세는 Task 9 병합 후) |
| 예비 | GPT-2 | 막힌 Task를 리더 지시로 넘겨받는다 |

### 3단계: Apply·Recommend 재구성 (Task 14~21)

- 사양은 `docs/superpowers/specs/2026-11-21-apply-recommend-design.md`, 계획은 `docs/superpowers/plans/2026-11-21-apply-recommend.md`다.
- 이번 단계는 사용자 지시로 리더(Claude-1)도 Task 14를 맡는다. 다른 사람 PR의 리뷰와 병합은 그대로 Claude-1이 한다.

| Task | 담당 | 시작 조건 |
|---|---|---|
| 14 아카이브 정리·파일 올리기·RECOMMEND 뼈대 | Claude-1 | 지금 (PR #29에 이어서) |
| 15 스키마·공고 데이터·샘플 | Claude-2 | 지금 |
| 16 공고 수집 AI(이슈·주간 워크플로) | GPT-1 | Task 15 병합 후 (스킬 문서 초안은 지금) |
| 17 지원서 양식·추천 스킬 확장 | AGY-1 | Task 15 병합 후 (스킬 문서 초안은 지금) |
| 18 APPLY 모집 공고 보드 | Claude-3 | Task 14·15 병합 후 |
| 19 지원서 작성 화면 | Claude-4 | Task 15 병합 후 |
| 20 RECOMMEND 화면 | GPT-2 | Task 14·15 병합 후 |
| 21 링크드인·리멤버 내보내기 | Claude-2 | Task 15를 끝낸 뒤 이어서 |

### 디자인 개선 (GPT-3 고정)

- **작업 전에 반드시 `.claude/skills/apple-design/SKILL.md`를 끝까지 읽는다.** 디자인 판단은 이 파일을 기준으로 하고, 색·폰트는 계획의 기본값과 `profile.yml`이 우선한다.
- 이미 병합된 화면만 다듬는다. 진행 중인 Task의 화면은 그 Task가 병합된 뒤에 손댄다.
- 디자인 개선 PR은 파일 소유 규칙의 예외로, 병합된 UI 파일(`.astro`, `global.css`)을 고칠 수 있다. 동작·데이터·`src/lib/`·테스트는 바꾸지 않는다. 바꿔야 하면 PR 본문의 "필요한 변경"에 적는다.
- 브랜치는 `design-<짧은-영문>`, PR 제목은 `[디자인] <내용>`이다. PR 본문에 고친 화면의 전후 스크린샷을 붙인다.

## 파일 소유

- 계획의 각 Task **Files** 목록에 있는 파일은 그 Task 담당만 만들고 고친다.
- 남의 파일을 고쳐야 하면 고치지 말고 PR 본문에 "필요한 변경"으로 적는다. 리더가 정리한다.
- 겹치기 쉬운 파일:
  - `package.json`·`package-lock.json`: **Task 1이 계획 Tech Stack의 의존성을 전부 설치한다**(`motion`, `@vite-pwa/astro`, `yaml`, `vitest` 포함). 다른 Task는 의존성을 추가하지 않는다. `scripts` 추가가 필요하면 PR 본문에 적는다.
  - `astro.config.mjs`: Task 1이 만들고 Task 7만 고친다.
  - `Nav.astro`·`global.css`·`Base.astro`: Task 2 소유. 페이지별 스타일은 각 페이지·컴포넌트의 `<style>` 안에 둔다.
  - `CLAUDE.md`: 첫 줄 `@AGENTS.md`는 그대로 두고, Task 8이 그 아래에 제품 규칙을 쓴다.
  - `.gitignore`: 이미 있다. Task 1은 필요한 줄만 추가한다.

## 작업 흐름

1. `git pull` 후 브랜치를 만든다: `task-<번호>-<짧은-영문>` (예 `task-4-archive`).
2. 계획의 해당 Task Steps대로 구현한다. UI Task(2~6)는 시작 전에 `.claude/skills/apple-design/SKILL.md`를 읽는다.
3. PR을 올리기 전에 `git rebase origin/main`으로 main을 따라가고, `npm test`와 `npm run build`를 둘 다 통과시킨다.
4. PR을 main으로 올린다.
   - 제목: `[Task N] <내용>`
   - 본문 첫 줄: `작성: <번호>` (예 `작성: GPT-2`)
   - 본문: 한 일, 테스트 결과, 못 한 일과 남은 위험, 다른 Task 파일에 필요한 변경
5. **main에 직접 푸시하지 않는다. 병합은 Claude-1만 한다.** 리뷰 코멘트가 오면 같은 브랜치에 커밋을 더한다.

## main 브랜치 보호

main은 GitHub 브랜치 보호가 걸려 있다. 관리자도 직접 푸시할 수 없고 PR로만 병합된다. 강제 푸시와 삭제도 막혀 있다.

- **Task 8(GPT-1) 주의:** 계획에는 "AI 브랜치를 빌드 검증 후 main에 병합"이라고 되어 있다. 하지만 보호 때문에 `git push`나 `git merge`로 main에 직접 넣으면 실패한다. `ai.yml`은 AI 브랜치로 PR을 만들고(`gh pr create`), 빌드가 통과하면 `gh pr merge --squash`로 병합한다. 빌드가 실패하면 병합하지 않고 이슈에 댓글을 단다. 병합은 `GITHUB_TOKEN`(`contents`·`pull-requests`·`actions: write`)으로 한다. GITHUB_TOKEN 병합은 `push(main)` 워크플로를 깨우지 않으므로, 병합 뒤 `gh workflow run deploy.yml --ref main`으로 배포를 직접 시작한다. 다른 앱의 토큰을 내부 엔드포인트로 받아 쓰지 않는다.
- **Task 7(AGY-1) 주의:** `deploy.yml`에는 계획대로 `push(main)`·`workflow_dispatch`·`workflow_call`을 모두 넣는다. Task 8은 `workflow_dispatch`로 호출한다.
- 리더도 main에는 PR로만 병합한다.

## 커밋

- 메시지는 한국어로 짧게, 접두어를 붙인다: `feat:` `fix:` `test:` `docs:` `chore:`
- 비밀값(토큰, `.env`)은 커밋하지 않는다.
