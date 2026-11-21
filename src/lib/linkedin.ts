// 링크드인·리멤버에는 공개 프로필 쓰기 API가 없어서, 입력 칸에 붙여 넣을 문구와 공식 URL만 만든다.
import type { EntryData } from './schema';
import type { EntryType } from './types';

/** 내보내기에 쓰는 항목 필드 (EntryData를 그대로 넘기면 된다) */
export type ExportEntry = Pick<EntryData, 'type' | 'title' | 'date' | 'org' | 'role' | 'summary' | 'metrics' | 'tags' | 'public'> & {
  end?: Date;
};

/** 날짜만 있는 값은 UTC 자정으로 들어오므로 UTC로 꺼낸다 */
const ym = (d: Date) => `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
const period = (e: ExportEntry) => (e.end ? `${ym(e.date)} – ${ym(e.end)}` : ym(e.date));

/** 값이 있는 줄만 남긴다 */
function lines(...xs: (string | false | undefined)[]): string {
  return xs.filter((x): x is string => !!x).join('\n');
}

/** 설명 칸: 요약 → 성과 목록 → 관련 기술 */
function description(e: ExportEntry): string {
  return lines(
    '설명:',
    e.summary,
    ...e.metrics.map((m) => `- ${m}`),
    e.tags.length > 0 && `관련 기술: ${e.tags.join(', ')}`,
  );
}

/** 링크드인 프로필의 종류별 입력 칸 순서로 만든 복사용 문구 */
export function linkedinText(e: ExportEntry): string {
  switch (e.type) {
    case 'career':
    case 'activity':
      // 경력(Experience): 직함 · 회사 · 기간 · 설명
      return lines(`직함: ${e.role ?? e.title}`, e.org && `회사: ${e.org}`, `기간: ${period(e)}`, description(e));
    case 'project':
    case 'research':
      // 프로젝트: 이름 · 기간 · 관련 소속 · 설명
      return lines(`프로젝트 이름: ${e.title}`, `기간: ${period(e)}`, e.org && `관련 소속: ${e.org}`, description(e));
    case 'award':
      // 수상(Honors & awards): 수상명 · 수여 기관 · 수상일 · 설명
      return lines(`수상명: ${e.title}`, e.org && `수여 기관: ${e.org}`, `수상일: ${ym(e.date)}`, description(e));
    case 'certificate':
      // 자격증(Licenses & certifications): 이름 · 발급 기관 · 발급일 · 만료일
      return lines(
        `자격증 이름: ${e.title}`,
        e.org && `발급 기관: ${e.org}`,
        `발급일: ${ym(e.date)}`,
        e.end && `만료일: ${ym(e.end)}`,
        description(e),
      );
    case 'education':
      // 학력(Education): 학교 · 학위·전공 · 기간 · 설명
      return lines(e.org && `학교: ${e.org}`, `학위·전공: ${e.title}`, `기간: ${period(e)}`, description(e));
    default:
      return lines(`제목: ${e.title}`, `기간: ${period(e)}`, e.org && `소속: ${e.org}`, description(e));
  }
}

/** 링크드인 공식 "프로필에 추가"(자격증) URL. certificate가 아니면 undefined */
export function linkedinCertUrl(e: ExportEntry): string | undefined {
  if (e.type !== 'certificate') return undefined;
  const params: [string, string][] = [
    ['startTask', 'CERTIFICATION_NAME'],
    ['name', e.title],
    ...(e.org ? ([['organizationName', e.org]] as [string, string][]) : []),
    ['issueYear', String(e.date.getUTCFullYear())],
    ['issueMonth', String(e.date.getUTCMonth() + 1)],
    ...(e.end
      ? ([
          ['expirationYear', String(e.end.getUTCFullYear())],
          ['expirationMonth', String(e.end.getUTCMonth() + 1)],
        ] as [string, string][])
      : []),
  ];
  return `https://www.linkedin.com/profile/add?${params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
}

/** 링크드인 공유 URL */
export function linkedinShareUrl(pageUrl: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}`;
}

/** 리멤버 경력 입력에 쓰는 섹션 순서와 칸 */
const REMEMBER: { type: EntryType; heading: string; item: (e: ExportEntry) => string }[] = [
  {
    type: 'career',
    heading: '경력',
    item: (e) =>
      lines(
        e.org && `회사명: ${e.org}`,
        `직책: ${e.role ?? e.title}`,
        `재직 기간: ${period(e)}`,
        `담당 업무: ${e.summary}`,
        ...e.metrics.map((m) => `- ${m}`),
      ),
  },
  {
    type: 'education',
    heading: '학력',
    item: (e) => lines(e.org && `학교명: ${e.org}`, `전공·과정: ${e.title}`, `기간: ${period(e)}`),
  },
  {
    type: 'activity',
    heading: '활동',
    item: (e) =>
      lines(e.org && `기관명: ${e.org}`, `역할: ${e.role ?? e.title}`, `기간: ${period(e)}`, `내용: ${e.summary}`, ...e.metrics.map((m) => `- ${m}`)),
  },
];

/** 리멤버 경력 입력용 문구. 공개 항목의 경력·학력·활동만, 섹션 안은 최신순 */
export function rememberText(entries: ExportEntry[]): string {
  const visible = entries.filter((e) => e.public);
  return REMEMBER.map(({ type, heading, item }) => {
    const items = visible.filter((e) => e.type === type).sort((a, b) => b.date.getTime() - a.date.getTime());
    return items.length > 0 ? [`[${heading}]`, items.map(item).join('\n\n')].join('\n') : '';
  })
    .filter(Boolean)
    .join('\n\n');
}
