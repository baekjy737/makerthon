# Vercel + Supabase 이전: 인수인계와 결정 사항

- 날짜: 2026-11-21
- 작성: Claude-1(이전 리더). 이 문서부터 리더는 **Claude-4**다.
- 이유: GitHub 구조(Pages, 이슈 기반 AI 요청, 보호된 main에 PR로만 반영)의 제약이 커서 서버와 DB가 있는 구조로 옮긴다.

## 확정된 결정

| 항목 | 결정 |
|---|---|
| 호스팅 | Vercel 웹사이트 |
| DB | **Supabase** (Postgres). Firebase는 쓰지 않는다 |
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
