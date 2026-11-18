import { normalizeBirth } from "@/lib/format";
import { parseTable, pick, pickRaw } from "@/lib/csv";
import { normalizeCode } from "@/lib/sections";
import { db } from "@/lib/supabase";

export type RosterRow = {
  line: number; // 파일의 행 번호 (헤더 = 1)
  studentNo: string;
  name: string;
  birth: string | null;
  department: string;
  course: string;
  section: string;
  requiredCount: number; // 공가 주차 = 제출할 과제 수 (1~3), 비우면 3
  errors: string[];
  warnings: string[];
};

// "2", "2주", "2주차" → 2. 1~3이 아니면 null
export function parseWeeks(v: unknown): number | null {
  const m = String(v ?? "").trim().match(/^([1-3])\s*(주|주차)?$/);
  return m ? Number(m[1]) : null;
}

export const REQUIRED = ["학번", "이름", "생년월일", "학과", "과목", "분반"];

export async function analyzeRoster(input: { text?: string; base64?: string }) {
  const raw = parseTable(input);
  const headerKeys = new Set(Object.keys(raw[0] ?? {}));
  const missingCols = REQUIRED.filter((c) => !headerKeys.has(c) && !(c === "과목" && headerKeys.has("과목명")));
  const rows: RosterRow[] = raw.map((r, i) => {
    const birthRaw = pickRaw(r, ["생년월일", "birth", "birthdate"]);
    const row: RosterRow = {
      line: i + 2,
      studentNo: pick(r, ["학번", "studentno", "student_no"]),
      name: pick(r, ["이름", "성명", "name"]),
      birth: normalizeBirth(birthRaw),
      department: pick(r, ["학과", "department"]),
      course: pick(r, ["과목", "과목명", "course"]),
      section: normalizeCode(pick(r, ["분반", "section"])),
      requiredCount: 3,
      errors: [],
      warnings: [],
    };
    const weeks = pick(r, ["공가주차", "공가인정주차", "과제수"]);
    if (weeks) {
      const n = parseWeeks(weeks);
      if (n === null) row.errors.push("공가주차는 1~3 (예: 2 또는 2주)");
      else row.requiredCount = n;
    }
    if (!row.studentNo) row.errors.push("학번 빈 칸");
    else if (!/^[A-Za-z0-9-]{4,20}$/.test(row.studentNo)) row.errors.push("학번 형식 오류");
    if (!row.name) row.errors.push("이름 빈 칸");
    if (birthRaw === "") row.errors.push("생년월일 빈 칸");
    else if (!row.birth) row.errors.push("생년월일 형식 오류 (예: 2003-05-07 또는 20030507)");
    if (!row.department) row.errors.push("학과 빈 칸");
    if (!row.course) row.errors.push("과목 빈 칸");
    if (!row.section) row.errors.push("분반 빈 칸");
    return row;
  });

  // 파일 안 중복: 같은 학번+과목+분반 / 같은 학번인데 이름·생년월일이 다름
  const seen = new Map<string, number>();
  const ident = new Map<string, { name: string; birth: string | null; line: number }>();
  for (const r of rows) {
    if (!r.studentNo) continue;
    const k = `${r.studentNo}|${r.course}|${r.section}`;
    if (seen.has(k)) r.errors.push(`중복 학번 (${seen.get(k)}행과 같은 과목·분반)`);
    else seen.set(k, r.line);
    const id = ident.get(r.studentNo);
    if (!id) ident.set(r.studentNo, { name: r.name, birth: r.birth, line: r.line });
    else if (id.name !== r.name || id.birth !== r.birth) r.errors.push(`같은 학번(${id.line}행)인데 이름 또는 생년월일이 다름`);
  }

  // 이미 등록된 학생이면 안내
  const nos = Array.from(new Set(rows.filter((r) => r.studentNo).map((r) => r.studentNo)));
  const existing = new Map<string, string>();
  for (let i = 0; i < nos.length; i += 200) {
    const { data } = await db().from("students").select("student_no, name").in("student_no", nos.slice(i, i + 200));
    for (const s of data ?? []) existing.set(s.student_no, s.name);
  }
  for (const r of rows) {
    const name = existing.get(r.studentNo);
    if (name !== undefined) r.warnings.push(name === r.name ? "이미 등록된 학생 (정보 갱신)" : `이미 등록된 학생 '${name}' — 이름이 바뀜`);
  }
  return { rows, missingCols };
}
