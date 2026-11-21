import { describe, expect, test } from 'vitest';
import { linkedinCertUrl, linkedinShareUrl, linkedinText, rememberText, type ExportEntry } from '../src/lib/linkedin';
import { entrySchema } from '../src/lib/schema';

const entry = (o: Record<string, unknown>): ExportEntry => entrySchema.parse({ title: 't', date: '2026-01-01', summary: '요약', ...o });

describe('linkedinText', () => {
  test('career: 직함·회사·기간·설명(요약·성과·태그) 순서', () => {
    const t = linkedinText(
      entry({
        type: 'career',
        title: '로봇 연구실 하계 인턴',
        org: '샘플 로봇 연구실',
        role: '학부 연구 인턴',
        date: '2025-07-01',
        end: '2025-08-31',
        summary: 'ROS2 파이프라인 구축',
        metrics: ['수집 자동화'],
        tags: ['ROS2', 'Python'],
      }),
    );
    expect(t).toBe(
      [
        '직함: 학부 연구 인턴',
        '회사: 샘플 로봇 연구실',
        '기간: 2025.07 – 2025.08',
        '설명:',
        'ROS2 파이프라인 구축',
        '- 수집 자동화',
        '관련 기술: ROS2, Python',
      ].join('\n'),
    );
  });

  test('activity: 역할이 없으면 제목이 직함, 소속이 없으면 회사 줄을 뺌', () => {
    const t = linkedinText(entry({ type: 'activity', title: '코딩 동아리', date: '2026-03-01' }));
    expect(t.split('\n').slice(0, 2)).toEqual(['직함: 코딩 동아리', '기간: 2026.03']);
    expect(t).not.toContain('회사:');
  });

  test('project·award·certificate는 각 입력 칸 이름', () => {
    expect(linkedinText(entry({ type: 'project', title: 'AI 아카이빙', org: 'DGIST' }))).toMatch(/^프로젝트 이름: AI 아카이빙\n기간: 2026\.01\n관련 소속: DGIST\n설명:\n요약$/);
    expect(linkedinText(entry({ type: 'award', title: '해커톤 2등', org: '운영위원회', date: '2026-05-01' }))).toMatch(/^수상명: 해커톤 2등\n수여 기관: 운영위원회\n수상일: 2026\.05\n설명:/);
    const cert = linkedinText(entry({ type: 'certificate', title: 'TOEIC 900', org: 'ETS', date: '2026-02-01', end: '2028-02-01' }));
    expect(cert).toMatch(/^자격증 이름: TOEIC 900\n발급 기관: ETS\n발급일: 2026\.02\n만료일: 2028\.02/);
  });

  test('학력과 그 밖의 종류', () => {
    expect(linkedinText(entry({ type: 'education', title: '기초학부 학사과정', org: 'DGIST', date: '2022-03-01' }))).toMatch(/^학교: DGIST\n학위·전공: 기초학부 학사과정\n기간: 2022\.03/);
    expect(linkedinText(entry({ type: 'paper', title: '리뷰 논문 읽기' }))).toMatch(/^제목: 리뷰 논문 읽기\n기간: 2026\.01/);
  });
});

describe('linkedinCertUrl', () => {
  test('certificate만, 한글·특수문자 인코딩', () => {
    const u = linkedinCertUrl(entry({ type: 'certificate', title: '정보처리기사 & 실기', org: '한국산업인력공단', date: '2026-06-15' }))!;
    expect(u).toBe(
      'https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME' +
        `&name=${encodeURIComponent('정보처리기사 & 실기')}` +
        `&organizationName=${encodeURIComponent('한국산업인력공단')}` +
        '&issueYear=2026&issueMonth=6',
    );
    expect(new URL(u).searchParams.get('name')).toBe('정보처리기사 & 실기');
  });

  test('만료일이 있으면 붙이고, 발급 기관이 없으면 뺌', () => {
    const u = new URL(linkedinCertUrl(entry({ type: 'certificate', title: 'X', date: '2026-02-01', end: '2028-11-01' }))!);
    expect(u.searchParams.has('organizationName')).toBe(false);
    expect(u.searchParams.get('expirationYear')).toBe('2028');
    expect(u.searchParams.get('expirationMonth')).toBe('11');
  });

  test('certificate가 아니면 undefined', () => {
    expect(linkedinCertUrl(entry({ type: 'award' }))).toBeUndefined();
  });
});

test('linkedinShareUrl', () => {
  expect(linkedinShareUrl('https://a.github.io/makerthon/portfolio/x/?from=archive')).toBe(
    'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent('https://a.github.io/makerthon/portfolio/x/?from=archive'),
  );
});

describe('rememberText', () => {
  const xs = [
    entry({ type: 'activity', title: '코딩 동아리', org: '동아리', role: '부원', date: '2026-03-01', summary: '스터디' }),
    entry({ type: 'career', title: '인턴 A', org: '회사 A', role: '인턴', date: '2024-01-01', end: '2024-02-28', summary: '옛 인턴' }),
    entry({ type: 'career', title: '인턴 B', org: '회사 B', date: '2025-07-01', summary: '새 인턴', metrics: ['성과'] }),
    entry({ type: 'career', title: '비공개 인턴', org: '비밀', date: '2026-01-01', summary: '숨김', public: false }),
    entry({ type: 'education', title: '학사과정', org: 'DGIST', date: '2022-03-01', summary: '입학' }),
    entry({ type: 'project', title: '프로젝트', date: '2026-01-01' }),
  ];

  test('경력·학력·활동 순, 섹션 안은 최신순, 입력 칸 순서', () => {
    expect(rememberText(xs)).toBe(
      [
        '[경력]',
        '회사명: 회사 B',
        '직책: 인턴 B',
        '재직 기간: 2025.07',
        '담당 업무: 새 인턴',
        '- 성과',
        '',
        '회사명: 회사 A',
        '직책: 인턴',
        '재직 기간: 2024.01 – 2024.02',
        '담당 업무: 옛 인턴',
        '',
        '[학력]',
        '학교명: DGIST',
        '전공·과정: 학사과정',
        '기간: 2022.03',
        '',
        '[활동]',
        '기관명: 동아리',
        '역할: 부원',
        '기간: 2026.03',
        '내용: 스터디',
      ].join('\n'),
    );
  });

  test('비공개 항목과 다른 종류는 빠짐', () => {
    const t = rememberText(xs);
    expect(t).not.toContain('비밀');
    expect(t).not.toContain('프로젝트');
  });

  test('해당 기록이 없으면 빈 문자열', () => {
    expect(rememberText([entry({ type: 'award' })])).toBe('');
  });
});
