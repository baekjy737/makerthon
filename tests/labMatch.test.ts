import { describe, expect, test } from 'vitest';
import type { Lab } from '../src/lib/data';
import { matchLabs } from '../src/lib/labMatch';

const lab = (id: string, o: Partial<Lab> = {}): Lab => ({
  id,
  name: id,
  dept: '기초학부',
  summary: '',
  courses: [],
  internTopics: [],
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
