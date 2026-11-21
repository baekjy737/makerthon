import coursesJson from '../../data/courses.json';
import internsJson from '../../data/interns.json';
import labsJson from '../../data/labs.json';

export interface Lab {
  id: string;
  name: string;
  dept: string;
  lab?: string;
  homepage?: string;
  summary: string;
  courses: string[];
  internTopics: string[];
}

export interface Intern {
  id: string;
  company: string;
  title: string;
  category: string;
  tags: string[];
  start?: string;
  deadline?: string;
  url?: string;
  verified: boolean;
  eligibility?: string;
}

export interface Course {
  code: string;
  name: string;
  kind: string;
  year: number;
  credits: number;
  prereq: string[];
}

export const labs: Lab[] = labsJson;
export const interns: Intern[] = internsJson;
export const courses: Course[] = coursesJson;

const labById = new Map<string, Lab>(labs.map((lab) => [lab.id, lab]));
const internById = new Map<string, Intern>(interns.map((intern) => [intern.id, intern]));

export function findTarget(
  kind: 'lab' | 'company' | 'intern',
  target: string,
): { title: string; url?: string } | undefined {
  if (kind === 'lab') {
    const found = labById.get(target);
    if (!found) return undefined;
    return {
      title: `${found.name} 교수 · ${found.lab ?? found.dept}`,
      ...(found.homepage ? { url: found.homepage } : {}),
    };
  }

  if (kind === 'intern') {
    const found = internById.get(target);
    if (!found) return undefined;
    return {
      title: `${found.company} ${found.title}`,
      ...(found.url ? { url: found.url } : {}),
    };
  }

  const found = interns.find((intern) => intern.company === target);
  if (!found) return undefined;
  return { title: found.company };
}
