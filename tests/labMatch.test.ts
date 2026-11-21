import { describe, expect, test } from 'vitest';
import type { Lab } from '../src/lib/data';
import type { ResearchTopic } from '../src/lib/openings';
import { matchLabs, matchTopics } from '../src/lib/labMatch';

const lab = (id: string, o: Partial<Lab> = {}): Lab => ({
  id,
  name: id,
  dept: '기초학부',
  summary: '',
  courses: [],
  internTopics: [],
  ...o,
});

const topic = (id: string, o: Partial<ResearchTopic> = {}): ResearchTopic => ({
  id,
  org: 'POSTECH',
  program: '동계 연구인턴',
  division: '기계공학과',
  professor: '홍길동',
  lab: '지능로봇 연구실',
  topic: '',
  category: '',
  crossSchool: '가능',
  eligibility: '학부생',
  requirements: '',
  deadline: '2026-11-30',
  url: 'https://example.com',
  ...o,
});

describe('matchLabs', () => {
  test('맞은 관심사 수 내림차순으로 정렬하고 맞지 않는 연구실은 제외', () => {
    const result = matchLabs(
      [
        lab('one', { summary: 'DNA 손상 반응을 연구한다.' }),
        lab('two', { summary: 'DNA 손상 반응', internTopics: ['로봇 제어와 자율주행'] }),
        lab('none', { summary: '광학 소자 연구' }),
      ],
      ['DNA 손상 반응', '로봇 제어'],
    );

    expect(result.map((x) => x.lab.id)).toEqual(['two', 'one']);
    expect(result[0].hits).toEqual(['DNA 손상 반응', '로봇 제어']);
    expect(result[1].hits).toEqual(['DNA 손상 반응']);
  });

  test('관심사가 비어 있으면 전체 연구실을 원래 순서와 빈 hits로 반환', () => {
    const input = [lab('a'), lab('b')];
    expect(matchLabs(input, [])).toEqual([
      { lab: input[0], hits: [] },
      { lab: input[1], hits: [] },
    ]);
    expect(matchLabs(input, ['  ', '\t'])).toEqual([
      { lab: input[0], hits: [] },
      { lab: input[1], hits: [] },
    ]);
  });

  test('대소문자와 모든 공백을 무시하고 중복 관심사는 한 번만 돌려줌', () => {
    const input = [
      lab('robot', {
        dept: 'ROBOTICS Department',
        internTopics: ['Human Robot Interaction'],
      }),
    ];

    const result = matchLabs(input, [' robotics ', 'HumanRobot Interaction', 'ROBOTICS']);
    expect(result).toHaveLength(1);
    expect(result[0].hits).toEqual(['robotics', 'HumanRobot Interaction']);
  });
});

describe('matchTopics', () => {
  test('주제·분야·연구실·학과에서 맞은 관심사 수 내림차순으로 정렬', () => {
    const result = matchTopics(
      [
        topic('one', { topic: 'DNA 손상 반응' }),
        topic('two', { lab: '로봇 제어 연구실', category: 'DNA 손상 반응' }),
        topic('none', { topic: '광학 소자' }),
      ],
      ['DNA 손상 반응', '로봇 제어'],
    );

    expect(result.map((x) => x.topic.id)).toEqual(['two', 'one']);
    expect(result[0].hits).toEqual(['DNA 손상 반응', '로봇 제어']);
    expect(result[1].hits).toEqual(['DNA 손상 반응']);
  });

  test('관심사가 비어 있으면 전체 주제를 원래 순서와 빈 hits로 반환', () => {
    const input = [topic('a'), topic('b')];
    expect(matchTopics(input, [' ', '\t'])).toEqual([
      { topic: input[0], hits: [] },
      { topic: input[1], hits: [] },
    ]);
  });

  test('대소문자와 모든 공백을 무시하고 중복 관심사는 한 번만 반환', () => {
    const input = [topic('robot', { division: 'ROBOTICS Department', topic: 'Human Robot Interaction' })];
    const result = matchTopics(input, [' robotics ', 'HumanRobot Interaction', 'ROBOTICS']);

    expect(result).toHaveLength(1);
    expect(result[0].hits).toEqual(['robotics', 'HumanRobot Interaction']);
  });

  test('실데이터의 빈 선택 필드는 무시하고 다른 필드로 계속 매칭', () => {
    const sparse = topic('sparse', { topic: '로봇 제어' });
    delete (sparse as Partial<ResearchTopic>).division;
    delete (sparse as Partial<ResearchTopic>).lab;

    expect(matchTopics([sparse], ['로봇 제어'])).toEqual([{ topic: sparse, hits: ['로봇 제어'] }]);
  });
});
