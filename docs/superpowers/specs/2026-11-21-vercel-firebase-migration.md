# Vercel + Firebase 이전: 인수인계와 결정 사항

- 날짜: 2026-11-21
- 작성: Claude-1(이전 리더). 이 문서부터 리더는 **Claude-4**다.
- 이유: GitHub 구조(Pages, 이슈 기반 AI 요청, 보호된 main에 PR로만 반영)의 제약이 커서 서버와 DB가 있는 구조로 옮긴다.

## 확정된 결정

| 항목 | 결정 |
|---|---|
| 호스팅 | Vercel 웹사이트 |
| DB | ~~Supabase~~ → **Firebase**(Firestore + Firebase Auth). 2026-11-21 사용자 결정으로 바꿨다. 아래 "결정" 참고 |
| 배포 단위 | **사람마다 배포하는 템플릿.** 학생 한 명이 자기 Vercel 프로젝트와 자기 Supabase 프로젝트를 하나씩 가진다. 여러 학생이 함께 쓰는 공용 사이트는 만들지 않는다 |

### 템플릿 방식이라서 생기는 일

- 로그인 사용자는 사실상 **주인 한 명**이다. Supabase Auth로 주인만 쓰기 권한을 갖고, 방문자는 공개 행만 읽는다.
- 비공개 처리는 RLS(행 단위 접근 제어)로 한다. 지금은 공개 저장소라면 `public: false` 원본도 GitHub에서 보였지만, 이전 뒤에는 정말로 숨길 수 있다.
- 학생 셋업은 "Vercel 프로젝트 만들기 + Supabase 프로젝트 만들기 + 환경 변수 연결 + 마이그레이션 실행"이 된다. README의 셋업 단계를 이 순서로 다시 쓴다.

## 이전 시점의 main 상태 (`81b5f85`)

- Task 1~21과 15b가 모두 병합됐다. Task 22(웹에서 AI 요청하기)는 사양·계획 문서만 있고 구현은 안 됐다. 이전 계획이 생겼으니 Task 22는 새 리더가 다시 판단한다.
- 열린 PR은 없다. `FULL=1 npm test` 199개가 통과하고 19페이지가 빌드된다.

## GitHub에 묶여 있어서 바꿔야 할 부분

| 지금 | 하는 일 | 이전할 때 |
|---|---|---|
| `content/**/*.md` + Astro 콘텐츠 컬렉션 | 항목·지원 건·추천·공고 저장 | Supabase 테이블로 옮긴다. 스키마는 `src/lib/schema.ts`에 zod로 이미 정리돼 있어 그대로 옮기기 좋다 |
| `public: false` | 사이트에서만 숨김. 원본 `.md`는 저장소에서 보임 | RLS로 진짜 비공개 처리 |
| `.github/workflows/ai.yml` + 이슈 | AI 요청 큐. 실행은 구독 토큰(`CLAUDE_CODE_OAUTH_TOKEN`) | 서버 함수에서 AI를 부르는 방식으로 바뀐다. 구독 토큰은 GitHub Action 전용이라, 서버에서는 Anthropic API 키(종량제)가 필요할 가능성이 크다. **비용 구조가 바뀌므로 아래 "아직 정할 것"에서 먼저 정한다** |
| `.github/scripts/ai-content.mjs` | AI 출력 검증(경로, 공개 설정 유지, 근거 ID가 공개 항목인지, 공고 URL 중복, 과목명·연구실 ID가 데이터에 있는지) | 검증 규칙을 서버에서 그대로 다시 구현한다. 지금까지 쌓은 안전장치의 핵심이라 빠뜨리지 않는다 |
| `.github/workflows/collect-openings.yml` | 주간 모집 공고 수집 | Vercel Cron 등으로 바꾼다 |
| `.github/workflows/deploy.yml`, `withBase`(22개 파일), PWA `base` | GitHub Pages의 `/makerthon/` 경로 처리 | Vercel은 루트 경로라 `BASE_URL=/`이면 그대로 동작한다. 당장 지울 필요는 없다 |
| localStorage | 메모, 공부 계획, 지원서 편집본, 메인 프로필 수정 | Supabase에 저장한다. 주인 로그인이 있으면 기기 사이에서도 유지된다 |
| `data/*.json` | 연구실·인턴·과목·연구인턴 데이터(정적) | 정적 파일로 둬도 되고 테이블에 넣어도 된다 |

## 아직 정할 것

1. **AI 실행 방식.** 서버에서 Anthropic API 키(종량제)로 부를지, 지금처럼 GitHub Action + 구독 토큰을 AI 실행에만 남겨 두고 결과만 Supabase에 쓸지 정한다. 비용과 학생 셋업 난이도가 달라진다.
2. **Task 22를 어떻게 할지.** 원래 목적(사이트 안에서 AI 요청)은 Supabase 구조에서 더 쉽게 된다. 그래서 GitHub PAT를 쓰는 지금 사양은 버리고 새로 쓰는 편이 맞을 가능성이 크다.
3. **Astro 유지 여부.** Astro는 서버 렌더링(Vercel 어댑터)을 지원하므로 그대로 쓸 수 있다. 프레임워크를 바꾸면 화면 코드를 다시 써야 한다.

## 이전 뒤에도 지킬 규칙

- 기존 Global Constraints(한국어 UI, 비공개 항목은 어디에도 안 나옴, AI는 사실을 지어내지 않음, 스프링은 오버슈트 없음, reduced-motion이면 페이드)는 그대로 유지한다.
- Review Focus 중 "다른 저장소 이름으로 배포"(1)는 Vercel에서는 의미가 줄어든다. 나머지(긴 메모 URL, localStorage 차단, AI 스키마 위반, 비공개 누출)는 저장소가 Supabase로 바뀌어도 같은 기준으로 테스트한다.

## 결정 (2026-11-21, 사용자) — 위 내용보다 우선한다

| 항목 | 결정 |
|---|---|
| DB·로그인 | **Firebase**: Firestore(콘텐츠·요청 대화), Firebase Auth(주인 Google 로그인). Supabase는 쓰지 않는다. 위 표의 "Supabase 테이블", "RLS"는 각각 Firestore 컬렉션, Firestore 보안 규칙으로 읽는다 |
| 파일 | **Vercel Blob.** Firebase Storage는 새 프로젝트에서 Blaze 요금제(카드 등록)가 필요해서 쓰지 않는다 |
| 호스팅 | Vercel 유지 |
| AI 실행 | **기본은 Vercel 서버 함수에서 Anthropic API 키.** **발표 데모에서는 이 컴퓨터의 Claude Code**(`npm run agent:local`)로 바로 처리한다. 두 방식 모두 결과를 Firestore에 쓴다 |
| 프레임워크 | Astro 유지 (`@astrojs/vercel` 어댑터) |
| Task 22 | 대화창 UI(`AgentDialog`)를 재사용하고 뒤쪽만 GitHub API에서 서버 API로 바꾼다. GitHub PAT는 없앤다 |

## 구조

```
브라우저 ─(주인 Google 로그인: Firebase Auth ID 토큰)─▶ /api/agent/* (Vercel 함수, firebase-admin)
                                                          │
        ┌─────────────────────────────────────────────────┤
        ▼                                                 ▼
 Firestore requests/{n}/comments              AI 파이프라인 (scripts/agent/pipeline.mjs)
                                               1. Firestore 문서 → 임시 작업 폴더(content/**.md, data/, CLAUDE.md, 스킬)
                                               2. AI 실행: Anthropic API(도구: 파일 읽기·찾기·web_fetch) 또는 claude -p
                                               3. ai-content.mjs 검증(기존 규칙 그대로, 작업 폴더 기준)
                                               4. 바뀐 파일 → Firestore, 첨부 → Vercel Blob, Vercel 배포 훅 호출
사이트 페이지 ◀── 빌드 때 Firestore 로더(로그인 없는 웹 SDK = 공개 문서만) ◀── 배포 훅으로 다시 빌드
```

- **페이지는 정적 빌드를 유지한다.** `content.config.ts`의 로더만 바꾼다. Firebase 환경 변수가 있으면 Firestore에서, 없으면 지금처럼 `content/`에서 읽는다(로컬 개발·테스트·템플릿 샘플용). 빌드는 로그인 없이 읽으므로 보안 규칙상 비공개 문서는 빌드 결과에 들어가지 않는다.
- 콘텐츠가 바뀌면 파이프라인이 Vercel 배포 훅을 불러 다시 빌드한다(약 1분). 개발 서버에서는 로더가 `.content-stamp` 파일을 지켜보다가 다시 읽는다.
- 쓰기는 전부 서버(firebase-admin 서비스 계정)에서만 한다. 보안 규칙은 공개 문서 읽기만 허용하고 클라이언트 쓰기는 모두 막는다. 주인 확인은 ID 토큰의 이메일과 `OWNER_EMAIL` 비교다.
- 콘텐츠 컬렉션은 지금 컬렉션 이름 그대로(`entries`, `applications`, `essays`, `next`, `matches`, `openings`). 문서는 `{ id, data(frontmatter), body(Markdown), public }`이고, 문서 ID는 `id`를 `encodeURIComponent`한 값이다(`/`가 들어간 ID 때문). zod 스키마는 로더에서 그대로 쓴다.
- 첨부: 공개 첨부는 Vercel Blob `archive/<항목>/<파일>`(공개 URL). 대화창 업로드는 브라우저가 Blob 클라이언트 업로드로 `uploads/<nonce>/<파일>`에 올리고, 참조 줄 `첨부: upload/<nonce>/<파일명>`은 그대로 쓴다.

## 이번 작업 범위

1. Firestore 보안 규칙·인덱스, 시드 스크립트(`content/`·`public/archive/` → Firestore·Blob)
2. Astro Vercel 어댑터, Firestore 콘텐츠 로더(파일 대체 포함)
3. `ai-content.mjs`를 작업 폴더 기준으로도 부를 수 있게(CLI·테스트는 그대로)
4. AI 파이프라인 + `/api/agent/*` + 주인 로그인, 대화창 재연결
5. 로컬 실행기(`agent:local`)가 같은 파이프라인으로 Claude Code를 쓰도록
6. README 셋업 단계 다시 쓰기

## 다음으로 미룬 것

- localStorage(메모·공부 계획·지원서 편집본·프로필 수정)의 Firestore 동기화
- 주간 공고 수집(`collect-openings.yml`)을 Vercel Cron으로 옮기기
- `.github/workflows/ai.yml`·이슈 템플릿 삭제(이전이 끝나고 확인한 뒤)
