# DGIST AI 아카이빙 시스템

활동 기록 하나를 원본으로 **아카이브 · 포트폴리오 · 이력서(A4 PDF) · 지원 현황** 사이트를 만들고, **Claude**가 활동 기록·공고 분석·자소서 초안을 대신 정리해 주는 개인 아카이브 템플릿입니다.

- Astro 사이트를 **Vercel**에 배포하고, 기록은 **Firebase**(Firestore)에 저장
- 사이트 안 대화창에서 AI에게 바로 요청 (주인 Google 로그인, 비공개 항목은 정말로 비공개)
- AI는 Vercel 서버에서 Anthropic API로 실행, 발표·데모 때는 내 컴퓨터의 Claude Code로 실행
- PWA 지원 (홈 화면 설치 가능, 방문한 페이지는 오프라인 열람)

---

## 시작하기 (Vercel + Firebase)

학생 한 명이 자기 저장소, 자기 Vercel 프로젝트, 자기 Firebase 프로젝트를 하나씩 가집니다. 모두 무료 요금제로 됩니다(Anthropic API 사용료는 별도).

### 1. 템플릿으로 내 저장소 만들기

이 저장소 우측 상단의 **Use this template** → **Create a new repository**로 본인 계정에 저장소를 만들고 `profile.yml`을 본인 정보로 고칩니다(아래 [`profile.yml` 예시](#profileyml-예시)).

### 2. Firebase 프로젝트 만들기

1. [Firebase 콘솔](https://console.firebase.google.com/)에서 **프로젝트 추가**. Spark(무료) 요금제 그대로 둡니다.
2. **Build → Firestore Database → 데이터베이스 만들기**(프로덕션 모드, 위치는 `asia-northeast3` 서울).
3. **Firestore → 규칙** 탭에 이 저장소의 [`firebase/firestore.rules`](firebase/firestore.rules) 내용을 붙여 넣고 **게시**합니다. 방문자는 공개 기록만 읽고, 쓰기는 서버만 할 수 있게 하는 규칙입니다.
4. **Build → Authentication → 시작하기 → Google** 로그인을 켭니다.
5. **프로젝트 설정 → 일반 → 내 앱 → 웹 앱(</>) 추가**에서 나오는 `apiKey`, `projectId`, `appId`를 적어 둡니다.
6. **프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성**으로 JSON 키 파일을 받습니다. **이 파일은 절대 커밋하지 마세요.**

### 3. Vercel 프로젝트 만들기

1. [Vercel](https://vercel.com/new)에서 GitHub 저장소를 **Import**합니다(프레임워크는 Astro로 자동 인식).
2. 프로젝트의 **Storage → Create → Blob**으로 Blob 스토어를 만들어 연결합니다(첨부 파일용, `BLOB_READ_WRITE_TOKEN`이 자동으로 들어갑니다).
3. **Settings → Environment Variables**에 아래 값을 넣습니다.

| 이름 | 값 |
|---|---|
| `PUBLIC_FIREBASE_API_KEY` | 2-5의 `apiKey` |
| `PUBLIC_FIREBASE_PROJECT_ID` | 2-5의 `projectId` |
| `PUBLIC_FIREBASE_APP_ID` | 2-5의 `appId` |
| `FIREBASE_SERVICE_ACCOUNT` | 2-6 JSON 파일 내용 전체(한 줄로 붙여 넣어도 됩니다) |
| `OWNER_EMAIL` | 사이트 주인 Google 계정 이메일. 이 계정만 AI에게 요청할 수 있습니다 |
| `ANTHROPIC_API_KEY` | [Claude Console](https://platform.claude.com/)에서 만든 API 키(종량제) |
| `ANTHROPIC_MODEL` | (선택) 기본 `claude-opus-5-5` |
| `VERCEL_DEPLOY_HOOK_URL` | 3-4에서 만든 배포 훅 주소 |

4. **Settings → Git → Deploy Hooks**에서 `main` 브랜치 훅을 만들고 주소를 `VERCEL_DEPLOY_HOOK_URL`에 넣습니다. AI가 기록을 반영하면 이 훅으로 사이트를 다시 빌드합니다(1~2분).
5. Firebase 콘솔 **Authentication → 설정 → 승인된 도메인**에 Vercel 주소(`<프로젝트>.vercel.app`)를 추가합니다.
6. **Deployments → Redeploy**로 한 번 다시 배포합니다.

### 4. 샘플·기존 기록 올리기

저장소 폴더에 `.env`를 만들고(커밋되지 않습니다) 3단계의 값을 같은 이름으로 넣은 뒤, `content/`의 기록과 `public/archive/` 첨부를 Firestore·Blob으로 올립니다.

```bash
npm ci
npm run seed -- --dry   # 올릴 목록 확인
npm run seed
```

Firebase 설정이 없으면 사이트는 예전처럼 `content/` 폴더를 읽습니다(로컬 개발·테스트용).

### 5. 사용해 보기

배포된 사이트에서 **AI에게 요청하기** 버튼 → **Google로 로그인**(`OWNER_EMAIL` 계정) → 내용을 쓰고 보내면, 서버가 처리하고 결과·질문을 같은 창에 보여 줍니다.

<details>
<summary>예전 방식: GitHub Pages + 이슈 + Claude Code Action</summary>

Firebase 설정 없이 GitHub Pages로 배포하면 대화창은 예전처럼 GitHub 이슈(PAT)로 요청하고 `.github/workflows/ai.yml`이 처리합니다.



#### 1. 템플릿으로 내 저장소 만들기

이 저장소 우측 상단의 **Use this template** → **Create a new repository**를 눌러 본인 계정에 새 저장소를 만듭니다.

> **공개 범위 안내:** 아래 [비공개 저장소 권장 안내](#공개-범위와-주의사항)를 먼저 확인한 뒤 Public / Private를 선택하세요.

#### 2. GitHub Pages 켜기

새 저장소에서 **Settings** → **Pages** → **Build and deployment** → **Source**를 **GitHub Actions**로 설정합니다.

이제 `main` 브랜치에 변경이 반영될 때마다 `.github/workflows/deploy.yml`이 자동으로 빌드·배포합니다.

#### `profile.yml` 예시

저장소 루트의 `profile.yml`을 본인 정보에 맞게 고칩니다. 색과 폰트는 비워 두면 기본값(다크 배경 `#0b0b0c`, 파란 포인트 `#3b82f6`, 한글 나눔스퀘어 네오, 영문 Anton)이 적용됩니다.

```yaml
name:
  ko: 홍길동
  line1: GILDONG
  line2: HONG
  line3: ROBOTICS × AI
monogram: GD.26
intro: "**DGIST 기초학부**에서 로봇과 AI를 공부하고 있습니다."
email: gildong@dgist.ac.kr
repo: your-id/your-repo-name
links:
  - label: GitHub
    url: https://github.com/your-id
theme:
  bg: "#0b0b0c"
  fg: "#f2f2f0"
  muted: "#8a8a8f"
  accent: "#3b82f6"
fonts:
  display:
    family: Anton
    css: https://fonts.googleapis.com/css2?family=Anton&display=swap
  ko:
    family: NanumSquareNeo
    boldFamily: NanumSquareNeoBold
    css: https://hangeul.pstatic.net/hangeul_static/css/nanum-square-neo.css
```

- `repo`에는 반드시 본인 저장소 이름(`아이디/저장소명`)을 적어야 관리 페이지의 AI 버튼이 본인 저장소로 연결됩니다.
- 앱 아이콘을 바꾸고 싶다면 `public/icons/icon-192.png`(192×192), `public/icons/icon-512.png`(512×512)을 교체하세요.

#### 4. Claude GitHub App 설치 및 Actions 권한 확인

1. [https://github.com/apps/claude](https://github.com/apps/claude)에 접속해 **Install**을 누르고, 방금 만든 본인 아카이브 저장소에 설치합니다.
2. 저장소의 **Settings** → **Actions** → **General** → **Workflow permissions**에서 **Allow GitHub Actions to create and approve pull requests**에 체크하고 저장합니다. (AI 자동화가 검증된 기록을 PR로 병합하기 위해 필요합니다.)

#### 5. `CLAUDE_CODE_OAUTH_TOKEN` Secret 등록

로컬 터미널에서 Claude Code CLI로 OAuth 토큰을 발급합니다.

```bash
claude setup-token
```

발급된 토큰을 복사한 뒤 저장소의 **Settings** → **Secrets and variables** → **Actions** → **New repository secret**에서 아래 이름으로 등록합니다.

- Name: `CLAUDE_CODE_OAUTH_TOKEN`
- Secret: 복사한 토큰 값

#### 6. 이슈 라벨 6개 만들기

AI 자동화가 이슈 종류를 구분할 수 있도록 저장소 폴더에서 GitHub CLI(`gh`)로 아래 라벨을 만듭니다.

```bash
gh label create archive --color 3b82f6 --description "활동 아카이빙 요청"
gh label create job     --color 10b981 --description "채용 공고 분석 요청"
gh label create essay   --color 8b5cf6 --description "자소서 초안 작성 요청"
gh label create memo    --color f59e0b --description "기존 항목에 메모 반영"
gh label create recommend --color ec4899 --description "다음 공부·진로 추천"
gh label create opening --color 0e7490 --description "지원 페이지에 모집 공고 추가"
```

</details>

---

## 공개 범위와 주의사항

- `public: false` 항목은 Firestore 보안 규칙으로 막혀 방문자가 읽을 수 없고, 사이트 빌드에도 들어가지 않습니다. AI 처리 때만 서버가 읽습니다.
- 지원 건·자소서·추천·모집 공고는 사이트에 공개됩니다.
- 대화창 첨부는 처리하는 동안 추측할 수 없는 주소(Vercel Blob)에 잠시 올라가고, 처리가 끝나면 지워집니다. 공개 항목에 붙인 첨부만 사이트에 남습니다.
- `.env`와 Firebase 서비스 계정 키는 커밋하지 마세요.
- 예전 방식(GitHub Pages)에서는 저장소가 공개면 `public: false` 원본도 GitHub에서 보입니다. 그 경우 비공개 저장소를 권장합니다.

---

## 사용하기

### GitHub 이슈로 AI에게 맡기기

사이트의 지원(`/apply`) 페이지 버튼이나 저장소의 **Issues → New issue**에서 템플릿을 골라 이슈를 올리면 Claude Code Action이 자동으로 처리하고 빌드 검증 후 `main`에 반영합니다.

| 라벨 | 기능 |
|---|---|
| `archive` | 메모·링크·첨부 파일로 활동 항목 Markdown 작성 |
| `job` | 채용 공고 분석, 항목별 적합도, 맞춤 이력서(`/resume/<공고>`) 생성 |
| `opening` | 공고 원문 URL에서 모집 기관·유형·접수 기간을 확인해 지원 페이지(`/apply`)에 공고 추가 |
| `essay` | 자소서 문항에 맞는 경험 추천 → 부족한 내용 질문 → 글자 수 맞춘 초안 작성 |
| `memo` | 상세 페이지 메모 패널에 적은 내용을 기존 항목 본문에 보강 |
| `recommend` | 공개 기록의 배운 점·남은 질문으로 다음 공부(`/next`)와 연구실·인턴 추천(`/match`) 갱신 |

날짜·역할 등 핵심 정보가 빠져 있으면 AI가 임의로 지어내지 않고 이슈 댓글로 되묻습니다. 답변 댓글을 달면 이어서 처리합니다.

### 발표 데모: 내 컴퓨터의 Claude Code로 처리하기

서버(Anthropic API) 대신 이 컴퓨터에 로그인된 Claude Code로 같은 요청을 처리합니다. 결과는 같은 검증을 거쳐 Firestore(또는 Firebase가 없으면 `content/` 파일)에 반영됩니다.

```bash
npm run agent:local   # 터미널 1: 로컬 실행기 (http://127.0.0.1:4330, .env를 읽음)
npm run dev           # 터미널 2: 개발 서버
```

개발 서버의 대화창은 로컬 실행기가 켜져 있으면 자동으로 그쪽으로 보내고(작성 화면에 "데모 모드" 표시), 반영되면 페이지를 새로고침하면 바로 보입니다. 배포 사이트에서도 쓰려면 `.env`에 `SITE_URL=https://<프로젝트>.vercel.app`, Vercel 환경 변수에 `PUBLIC_LOCAL_AGENT=http://127.0.0.1:4330`을 넣고 다시 배포하세요(브라우저가 로컬 네트워크 접근 허용을 물으면 허용).

### 로컬에서 Claude Code로 사용하기

이 저장소를 클론한 폴더에서 `claude`를 실행하면 GitHub Action과 똑같은 스킬(`.claude/skills/`)을 대화형으로 바로 쓸 수 있습니다.

```bash
git clone https://github.com/<본인-아이디>/<저장소명>.git
cd <저장소명>
npm ci
claude
```

실행 후 다음과 같이 요청해 보세요.

- `"이 메모 기록해줘: 2026-10 DGIST 메이커톤 참가, 팀장, AI 아카이빙 템플릿 제작"`
- `"이 채용 공고 분석해서 맞춤 이력서 만들어줘: <공고 내용 또는 링크>"`
- `"이 자소서 문항 초안 써줘 (800자 이내): <문항>"`

로컬에서 사이트를 미리 보려면 아래 명령을 실행합니다.

```bash
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run preview  # 빌드 결과 미리보기
npm test         # 단위 테스트
```
