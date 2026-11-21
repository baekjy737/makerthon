# Apply·Recommend 재구성 설계

작성 2026-11-21. 사용자와 Q1~Q6 및 붙여 준 Apply·Recommend 설명으로 합의한 내용이다. 기존 사양(`2026-11-21-archive-system-design.md`, `2026-11-21-study-career-design.md`)에 덧붙인다. 충돌하면 이 문서를 따른다.

## 두 탭의 역할

| 탭 | 역할 | Archive를 쓰는 방식 |
|---|---|---|
| **APPLY** | 지금 지원할 곳을 찾고 서류를 준비한다 | 지원서 문항에 쓸 **근거** |
| **RECOMMEND** | 관심사와 공부 기록으로 다음 공부와 연구실을 탐색한다 | 다음에 무엇을 공부할지 판단할 **근거** |

흐름: Recommend에서 관심 연구실 발견 → Apply에서 모집 공고 확인 → 지원서 업로드 → Archive에서 문항별 소재 선택 → 초안 작성.

## APPLY

### 모집 중인 기회
- 유형 4개를 탭으로 나눈다: 대학원 연구실 인턴(`lab-intern`), 연구과제 학부연구생(`undergrad-research`), 기업 인턴(`company-intern`), 기업 채용(`company-job`).
- 카드에는 기관·제목, 모집 대상, 자격 요건, 마감일, 원본 공고 링크를 보인다.
- 상태는 `모집 중`, `마감`, `확인 필요` 셋 중 하나다. 원문에서 접수 기간을 확인한 공고(`verified: true`)만, 빌드 시점이 기간 안일 때 `모집 중`이 된다. 마감일이 지난 공고는 빌드할 때 자동으로 `마감`이 된다.
- 데이터는 세 곳을 합친다.
  - `content/openings/<slug>.md`
  - `data/interns.json` 121건(모두 `company-intern`)
  - `data/research-internships.json`의 `programs` 51건(대학원·출연연 연구 인턴, 모두 `lab-intern`)
  - `research-internships.json`은 사용자가 준 스냅샷(2026-11-21)이다. `deadline`이 날짜로 있는 공고만 `verified: true`로 보고, 날짜가 없으면 `deadlineText`를 보인다.
- 연구실·기업 DB(`data/labs.json`, `data/interns.json`)는 기관과 분야를 찾는 데 쓴다.
- 수집은 두 경로로 한다.
  - **[공고 추가] 이슈**(`opening` 라벨): URL을 올리면 AI가 원문을 읽고 정리한다.
  - **주간 자동 수집** 워크플로: cron과 수동 실행을 둘 다 지원하고, 정해 둔 출처를 돈다.

### 지원서 작성
- [지원서 올리기] 버튼은 `essay` 이슈를 연다. 이슈에 양식 파일(PDF·이미지)이나 문항 원문을 붙인다.
- AI는 다음을 정리한다.
  - 문항과 글자 수 제한을 뽑는다.
  - 문항마다 아카이브에서 추천 소재 2~3개를 고른다. 소재마다 항목 ID, 추천 이유, 그 소재로 쓴 **초안**을 남긴다.
  - 기록에 개인 기여나 성과가 비어 있으면 '확인할 항목'으로 남긴다.
- 지원 건 페이지는 문항마다 다음 순서로 보인다: 추천 소재(선택) → 추천 이유와 아카이브 원본 링크 → 편집 가능한 초안 → 확인할 항목.
  - 소재를 고르면 그 소재의 초안이 곧바로 편집 칸에 뜬다.
  - 편집본은 localStorage에 저장한다.
  - [다듬기 요청]은 편집본을 담은 `essay` 이슈를 연다.
- 지원 건별 맞춤 이력서(`/resume/<app>/`) 링크를 지원 건 페이지에 둔다.

## RECOMMEND (`/recommend`, 메뉴 RECOMMEND)

- **연구실 탐색**: `labs.json` 157곳(DGIST)과 `research-internships.json`의 `topics` 365건(KAIST·POSTECH·서울대·ETRI 등 21개 기관의 연구실별 인턴 주제)을 `profile.yml`의 `interests`와 빌드 시점 키워드로 맞춰 보인다. 맞은 연구 주제를 강조하고, 모집 여부와 관계없이 탐색할 수 있다. 그 연구실의 열린 공고가 있으면 Apply의 해당 공고로 링크한다.
- **AI 추천 카드**: 기존 `matches`다. 맞는 연구 주제, 먼저 읽을 자료(`sources`), 근거 기록을 보인다.
- **다음 공부 미리보기**: 기존 `next`다. 이미 공부한 내용(`learned`) → 다음에 배울 개념(`next`) → 바로 해볼 공부·탐구 질문(`actions`, `questions`) 순서로 보인다.
- **[추천 받기]**: `recommend` 이슈를 연다.

## ARCHIVE

- 탭은 [활동 | 공부 기록]이다.
  - 공부 기록 안은 **연구**(`research`, `paper`)와 **공부**(`course`, `study`) 소제목으로 나눈다.
  - `research`는 활동 탭에서 뺀다. 이력서에는 그대로 남는다.
- 종류 필터로 숨긴 카드는 실제로 사라져야 한다. 카드가 모두 숨은 연도 묶음도 숨긴다.
- 아카이브에서 들어간 상세 페이지의 돌아가기 링크는 "← 아카이브"다. 그 외에는 "← 포트폴리오"다.
- **파일 올리기**는 정적 사이트라 토큰 없이 이슈 첨부로 한다.
  - 아카이브 페이지: [파일 올려 기록하기] 버튼이 `archive` 이슈를 연다.
  - 상세 페이지 메모 패널: [이 항목에 파일 추가] 버튼이 항목 ID를 채운 `memo` 이슈를 연다.
  - AI가 첨부를 `public/archive/<항목>/`로 옮긴다. 비공개 항목의 첨부는 `public/`에 넣지 않는다.

## 링크드인·리멤버

공개 프로필 쓰기 API가 없으므로 자동 동기화는 하지 않는다.
- `profile.yml` `links`에 LinkedIn·Remember 주소를 넣으면 히어로와 이력서에 보인다.
- 상세 페이지에는 [링크드인용 복사]를 둔다. 종류별 입력 칸(경력: 직함·회사·기간·설명 / 프로젝트 / 수상 / 자격증)에 맞춘 문구를 복사한다.
- 이력서 페이지에는 [리멤버 경력용 복사]를 둔다.
- `certificate` 항목에는 링크드인 공식 "프로필에 추가" URL(`https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=…&organizationName=…&issueYear=…&issueMonth=…`)을 둔다.
- 상세 페이지에는 공유 URL(`https://www.linkedin.com/sharing/share-offsite/?url=…`)을 둔다.
