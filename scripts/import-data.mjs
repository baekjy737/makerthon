#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function validIsoDate(value) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  const match = DATE_RE.exec(trimmed);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() + 1 !== month ||
    dt.getUTCDate() !== day
  ) {
    return undefined;
  }
  return trimmed;
}

function cleanString(value) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function parseInternDataJs(source) {
  const trimmed = source.trim();
  const match = trimmed.match(/^(?:const|let|var)\s+INTERN_DATA\s*=\s*([\s\S]*?);?$/);
  if (!match) {
    throw new Error('intern/data.js에서 INTERN_DATA 배열을 찾을 수 없습니다.');
  }
  const parsed = JSON.parse(match[1]);
  if (!Array.isArray(parsed)) {
    throw new Error('INTERN_DATA가 배열이 아닙니다.');
  }
  return parsed;
}

function convertLabs(displayRecords, enrichment) {
  const curriculumMap = enrichment.curriculum2025ByProfessorId ?? {};
  const summerMap = enrichment.summerInternship2026ByProfessorId ?? {};

  return displayRecords
    .filter((record) => record?.universityCode === 'DGIST')
    .map((record) => {
      const id = cleanString(record.professorId);
      const name = cleanString(record.nameKo);
      const dept = cleanString(record.affiliations?.[0]?.departmentNameKo) ?? '';
      const summer = id ? summerMap[id] : undefined;
      const curriculum = id ? curriculumMap[id] : undefined;

      const lab = cleanString(record.labNames?.[0]) ?? cleanString(summer?.labNameKo);
      const homepage = cleanString(record.officialUrl) ?? cleanString(record.homepage);
      const summary = cleanString(record.summaryKo) ?? '';

      const courses = (curriculum?.courses ?? [])
        .map((course) => cleanString(course))
        .filter((course) => Boolean(course) && course !== '자율적 수강 추천');

      const internTopics = (summer?.items ?? [])
        .map((item) => cleanString(item?.text))
        .filter(Boolean);

      return {
        id,
        name,
        dept,
        ...(lab ? { lab } : {}),
        ...(homepage ? { homepage } : {}),
        summary,
        courses,
        internTopics,
      };
    });
}

function convertInterns(rawInterns) {
  return rawInterns.map((record) => {
    const id = cleanString(record.record_id);
    const company = cleanString(record.company) ?? '';
    const title = cleanString(record.internship_name) ?? '';
    const category = cleanString(record.primary_category) ?? '';
    const tags = (typeof record.job_tags === 'string' ? record.job_tags : '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    const start = validIsoDate(record.application_start);
    const deadline = validIsoDate(record.application_deadline);
    const url = cleanString(record.source_url);
    const verified = record.verification_status === '검증됨';
    const eligibility = cleanString(record.eligibility_summary);

    return {
      id,
      company,
      title,
      category,
      tags,
      ...(start ? { start } : {}),
      ...(deadline ? { deadline } : {}),
      ...(url ? { url } : {}),
      verified,
      ...(eligibility ? { eligibility } : {}),
    };
  });
}

function main() {
  const sourceDir = process.argv[2];
  if (!sourceDir) {
    console.error('사용법: node scripts/import-data.mjs <원본폴더>');
    process.exit(1);
  }

  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const dataDir = path.join(rootDir, 'data');

  const displayPath = path.join(sourceDir, 'graduate/assets/runtime/display-records.json');
  const enrichPath = path.join(
    sourceDir,
    'graduate/assets/runtime/dgist-professor-enrichment.json',
  );
  const internPath = path.join(sourceDir, 'intern/data.js');

  const displayRecords = JSON.parse(fs.readFileSync(displayPath, 'utf8'));
  const enrichment = JSON.parse(fs.readFileSync(enrichPath, 'utf8'));
  const rawInterns = parseInternDataJs(fs.readFileSync(internPath, 'utf8'));

  const labs = convertLabs(displayRecords, enrichment);
  const interns = convertInterns(rawInterns);

  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'labs.json'), `${JSON.stringify(labs, null, 2)}\n`);
  fs.writeFileSync(path.join(dataDir, 'interns.json'), `${JSON.stringify(interns, null, 2)}\n`);

  console.log(`변환 완료: labs ${labs.length}건, interns ${interns.length}건`);
}

main();
