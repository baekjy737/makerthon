# AI-HUB 앱 제출 준비

2026-11-21, AI-HUB 앱 규칙(`get_app_rules`)을 읽고 정리했다. 이 저장소의 결과물을 AI-HUB **정적 웹앱(Type S)**으로 올릴 때 걸리는 점과 해야 할 일이다.

## AI-HUB 앱이 요구하는 것 (요약)

- zip 루트에 `plugin.json`과 엔트리 HTML이 있어야 한다. 폴더째 압축하면 거절된다.
- **외부 URL 금지.** HTML·JS·CSS·`.md`·`.txt` 등 모든 텍스트 파일에서 `http://`·`https://`·`//host`가 나오면 번들 전체가 거절된다. 외부 이동은 `plugin.json` 최상위 `links`에 고정 URL로 등록하고 `platform.links.open(id)`로만 연다.
- **인라인 `<script>`와 `onclick=` 금지.** 검증은 통과하지만 sandbox CSP(`script-src 'self'`) 때문에 실행만 안 된다. `<style>`·`style=`는 괜찮다.
- **절대경로(`/x`)·`../`·백슬래시 금지.** 자산은 모두 상대경로.
- `window.open`·`target="_blank"`·`<form>` 네이티브 제출 금지.
- 이메일·전화번호 **형태**의 문자열 금지(예시·placeholder 포함).
- 허용 확장자만: html js css json svg png jpg webp woff2 ttf 등. 파일 200개 이하, zip 20MB 이하.
- 저장은 `platform.storage` 또는 키트의 `storage-adapter.js`. raw `localStorage`는 미리보기 화면에서 SecurityError가 난다.

## 현재 설계와 부딪히는 곳

| 항목 | 현재 설계 | AI-HUB에서 | 해야 할 일 | 담당(배정표) |
|---|---|---|---|---|
| 웹폰트 | `Base.astro`가 Google Fonts·네이버 한글 CSS를 외부 링크로 부름(PR #5) | P-EXTURL로 거절 | 폰트 파일(woff2)을 `public/fonts/`에 넣고 `@font-face`로 상대경로 참조. Anton·나눔스퀘어 네오 라이선스(OFL) 확인 | Task 2 |
| `profile.yml` 주석 | 예시 이메일, 외부 URL 주석 | 빌드 결과에는 안 들어가므로 무관. 단 이력서에 **이메일을 출력하면** PII로 반려 | AI-HUB 빌드에서는 연락처(이메일·전화)를 출력하지 않기 | Task 2·5 |
| 경로 | `base = /makerthon`, `withBase()`가 절대경로 생성, 페이지가 `archive/index.html` 형태 | 절대경로 거절, 디렉터리 경로가 안 풀릴 수 있음 | AI-HUB용 빌드는 `build.format: 'file'`(→ `archive.html`) + 빌드 후 절대경로를 상대경로로 바꾸는 후처리 | Task 7 |
| Astro 스크립트 | 작은 스크립트는 HTML에 인라인으로 들어감 | 실행 차단 | AI-HUB 빌드에서 `vite.build.assetsInlineLimit: 0`. 빌드 후 인라인 `<script>` 0개인지 검사 | Task 7 |
| 히어로 움직임(`motion`) | npm 의존성 | 번들되어 같이 나가면 OK | 없음 | — |
| GitHub 이슈 버튼 | 미리 채운 이슈 URL(쿼리로 본문 전달, Task 6 `issue.ts`) | 앱 안 외부 URL 금지. `links`는 **고정 URL만** | AI-HUB 빌드에서는 "새 이슈 열기" 고정 링크 몇 개(`archive`·`job`·`essay`·`memo` 템플릿)를 `links`에 등록하고 `platform.links.open`으로 연다. 미리 채우기는 포기 | Task 6 |
| 관리 페이지 메모 | 브라우저 localStorage(Task 6 `memo.ts`) | 미리보기에서 죽음, 다른 앱과 키 충돌 | `storage-adapter.js`(키트 원본)를 동봉하고 `appStorage`로 교체. 값 8KB·키 50개 한도 | Task 6 |
| PWA(서비스 워커) | `@vite-pwa/astro` | sandbox iframe(opaque origin)에서 동작 안 함 | AI-HUB 빌드에서는 PWA를 끈다 | Task 7 |
| 공개 범위 | `public: false` 항목은 사이트에 안 나옴 | 같음 | AI-HUB 빌드 결과에도 비공개 항목이 없는지 확인 | Task 7 |

## 권장 방식

GitHub Pages 빌드는 그대로 두고, **AI-HUB용 빌드를 따로** 둔다.

1. `AIHUB=1` 환경변수일 때 `astro.config.mjs`가 `base`를 `/`로 두고 `build.format: 'file'`, `assetsInlineLimit: 0`, PWA 끄기를 적용한다.
2. `scripts/aihub-pack.mjs`가 `dist/`를 후처리한다: 절대경로를 상대경로로 바꾸고, `plugin.json`·`platform.js`·`storage-adapter.js`를 넣고, 위 자가검증 8개 패턴을 검사하고, 내용물만 zip으로 묶는다.
3. `package.json`에 `"build:aihub"` 스크립트를 추가한다(배정표상 Task 1 소유라 PR 본문에 요청).

## plugin.json 초안

```json
{
  "schema_version": "1.0",
  "id": "dgist-archive",
  "name": "AI 아카이빙 포트폴리오",
  "name_en": "AI Archive Portfolio",
  "version": "1.0.0",
  "type": "static",
  "entry": "index.html",
  "permissions": { "storage": true, "identity": [], "external_domains": [] },
  "links": [
    { "id": "repo", "label": "GitHub 저장소", "url": "<저장소 주소>" },
    { "id": "issue-archive", "label": "AI에게 기록 맡기기", "url": "<저장소 주소>/issues/new?template=archive.yml" }
  ],
  "visibility": "all"
}
```

`storage`는 관리 페이지 메모 때문에 켠다. 메모 기능을 AI-HUB판에서 빼면 `permissions`를 비워도 된다.

## 남은 확인

- `platform.js`·`storage-adapter.js`는 AI-HUB 웹의 스타터 키트(`/apps/starter-kit`)에서 받아 **수정 없이** 넣는다.
- 업로드 전에 `validate_app_bundle` 또는 업로드 페이지의 "검사만(드라이런)"으로 먼저 확인한다.
- 실행 확인은 키트의 `dev-harness/`로 한다.
