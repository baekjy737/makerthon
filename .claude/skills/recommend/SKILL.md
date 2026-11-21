---
name: recommend
description: 공개 공부·활동 기록을 근거로 다음 공부와 연구실·기업·인턴 추천을 작성한다. recommend 이슈, 대화에서의 추천 요청, archive·memo 기록 반영에 사용한다.
---

# 다음 공부와 진로 추천

1. `profile.yml`의 `interests`와 요청자가 특히 알고 싶은 분야를 확인한다. `content/entries/`의 공개 항목 전체에서 관심사와 연결되는 기록을 찾는다. `course`·`paper`·`study`는 `topics`, `## 배운 점`, `## 남은 질문`을 먼저 본다. `archive`·`memo`와 함께 작업하면 이번에 작성하거나 보강한 항목의 최종 내용을 기준으로 삼는다. `public: false`인 항목과 공개 페이지에서 숨기는 `## 자소서 재료`는 추천의 모든 필드와 본문에서 제외한다.
2. 관심 주제마다 `content/next/<slug>.md`를 한 개씩, 한 번에 최대 3개 작성한다. 기록에서 이미 익힌 내용을 `learned`에, 남은 질문을 풀기 위해 다음에 공부할 개념을 `next`에 넣는다. 탐구해 볼 새 질문은 `questions`에 제안한다. `resources.course`에는 `data/courses.json`의 `name` 또는 관련 연구실의 `courses`에 있는 과목명을 그대로 쓴다. 자료 주소를 확인한 경우에만 `resources.url`을 적는다.
3. `data/labs.json`의 연구 주제와 공개 기록을 대조해 연구실을 우선 추천한다. `data/interns.json`의 직무 태그와 내 기록이 맞을 때는 인턴·기업도 포함한다. `content/matches/<slug>.md`는 한 번에 최대 5개 작성한다.

   | `kind` | `target` | 대조할 자료 |
   | --- | --- | --- |
   | `lab` | 연구실 레코드의 `id` | `summary`, `internTopics`, `courses`, `homepage` |
   | `intern` | 공고의 `id` | `title`, `tags`, `eligibility`, `url` |
   | `company` | 공고의 `company` 원문 | 해당 회사 공고의 직무와 `tags`, `url` |

   `score`는 공개 기록과 주제·직무가 맞는 정도이며, `reason`에는 이를 뒷받침하는 구체적인 연결점을 쓴다. 연구실·기업·인턴에 관한 사실과 `sources` URL은 대상 레코드에서 확인된 값만 쓴다. 지원 자격이나 현재 모집 여부를 확인해야 하면 `check`에 남긴다.
4. 각 추천은 `CLAUDE.md`의 스키마를 따른다. `from`에는 해당 추천을 뒷받침하는 공개 항목 ID를 하나 이상 넣는다. 본문에는 어떤 기록의 어떤 질문이나 경험이 이 추천으로 이어졌는지 두세 문장으로 쓴다. 관심사만 있고 뒷받침할 공개 기록이 없거나 대상 데이터와의 연결이 약하면 그 추천은 생략한다.
5. 저장 전에 기존 추천을 확인한다. 같은 주제 또는 같은 `kind`·`target`의 파일은 slug와 `created`를 유지하고, 새 근거나 달라진 추천 내용만 반영한다. 새 파일명은 `YYYY-MM-<영문-kebab>.md`로 정한다. 독립적인 `recommend` 요청은 두 추천 폴더의 변경만 반환하며 첨부는 빈 배열이다. 변경할 추천이 없으면 `unchanged`로 이유를 알린다. `archive`·`memo`에 이어 실행할 때는 준비된 원래 변경과 첨부를 유지하고, 갱신한 추천을 같은 `ready` 결과에 담는다.
