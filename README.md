# DGIST AI 아카이빙 시스템

Markdown 항목 하나(`content/entries/*.md`)를 원본으로 **아카이브 · 포트폴리오 · 이력서(A4 PDF) · 지원 현황** 사이트를 만들고, **Claude Code**가 활동 기록·공고 분석·자소서 초안을 대신 정리해 주는 개인 아카이브 템플릿입니다.

- 정적 Astro 사이트 + GitHub Pages 자동 배포
- PWA 지원 (홈 화면 설치 가능, 방문한 페이지는 오프라인 열람)
- 사이트 버튼에서 GitHub 이슈를 열어 AI 자동 반영 (로그인·별도 서버 없음)

---

## 시작하기 (6단계 셋업)

### 1. 템플릿으로 내 저장소 만들기

이 저장소 우측 상단의 **Use this template** → **Create a new repository**를 눌러 본인 계정에 새 저장소를 만듭니다.

> **공개 범위 안내:** 아래 [비공개 저장소 권장 안내](#공개-범위와-주의사항)를 먼저 확인한 뒤 Public / Private를 선택하세요.

### 2. GitHub Pages 켜기

새 저장소에서 **Settings** → **Pages** → **Build and deployment** → **Source**를 **GitHub Actions**로 설정합니다.

이제 `main` 브랜치에 변경이 반영될 때마다 `.github/workflows/deploy.yml`이 자동으로 빌드·배포합니다.

### 3. `profile.yml` 수정하기

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

### 4. Claude GitHub App 설치 및 Actions 권한 확인

1. [https://github.com/apps/claude](https://github.com/apps/claude)에 접속해 **Install**을 누르고, 방금 만든 본인 아카이브 저장소에 설치합니다.
2. 저장소의 **Settings** → **Actions** → **General** → **Workflow permissions**에서 **Allow GitHub Actions to create and approve pull requests**에 체크하고 저장합니다. (AI 자동화가 검증된 기록을 PR로 병합하기 위해 필요합니다.)

### 5. `CLAUDE_CODE_OAUTH_TOKEN` Secret 등록

로컬 터미널에서 Claude Code CLI로 OAuth 토큰을 발급합니다.

```bash
claude setup-token
```

발급된 토큰을 복사한 뒤 저장소의 **Settings** → **Secrets and variables** → **Actions** → **New repository secret**에서 아래 이름으로 등록합니다.

- Name: `CLAUDE_CODE_OAUTH_TOKEN`
- Secret: 복사한 토큰 값

### 6. 이슈 라벨 5개 만들기

AI 자동화가 이슈 종류를 구분할 수 있도록 `archive`, `job`, `essay`, `memo`, `recommend` 라벨을 만듭니다. GitHub CLI(`gh`)가 설치되어 있다면 저장소 폴더에서 아래 5줄을 실행하면 됩니다.

```bash
gh label create archive --color 3b82f6 --description "활동 아카이빙 요청"
gh label create job     --color 10b981 --description "채용 공고 분석 요청"
gh label create essay   --color 8b5cf6 --description "자소서 초안 작성 요청"
gh label create memo    --color f59e0b --description "기존 항목에 메모 반영"
gh label create recommend --color ec4899 --description "다음 공부·진로 추천"
```

---

## 공개 범위와 주의사항

> **주의:** 저장소가 **공개(Public)** 상태이면 `public: false`로 표시한 항목도 **GitHub 저장소 소스 코드(`content/entries/`)에서는 누구나 볼 수 있습니다.**

- `public: false` 설정은 빌드된 웹 사이트(아카이브·포트폴리오·통계·이력서·맞춤 이력서)에서만 해당 항목을 숨깁니다.
- 민감한 개인 메모, 미공개 연구, 지원 내역 등을 함께 보관할 계획이라면 **비공개(Private) 저장소** 사용을 권장합니다.
- DGIST 학생은 `@dgist.ac.kr` 메일로 **GitHub Education(Student Developer Pack)**을 인증하면 비공개 저장소에서도 GitHub Pages를 무료로 사용할 수 있습니다.

---

## 사용하기

### GitHub 이슈로 AI에게 맡기기

사이트의 `/manage` 페이지 버튼이나 저장소의 **Issues → New issue**에서 템플릿을 골라 이슈를 올리면 Claude Code Action이 자동으로 처리하고 빌드 검증 후 `main`에 반영합니다.

| 라벨 | 기능 |
|---|---|
| `archive` | 메모·링크·첨부 파일로 활동 항목 Markdown 작성 |
| `job` | 채용 공고 분석, 항목별 적합도, 맞춤 이력서(`/resume/<공고>`) 생성 |
| `essay` | 자소서 문항에 맞는 경험 추천 → 부족한 내용 질문 → 글자 수 맞춘 초안 작성 |
| `memo` | `/manage` 메모 패널에 적은 내용을 기존 항목 본문에 보강 |
| `recommend` | 공개 기록의 배운 점·남은 질문으로 다음 공부(`/next`)와 연구실·인턴 추천(`/match`) 갱신 |

날짜·역할 등 핵심 정보가 빠져 있으면 AI가 임의로 지어내지 않고 이슈 댓글로 되묻습니다. 답변 댓글을 달면 이어서 처리합니다.

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
