// 파일 규칙 — 브라우저·서버 공용
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_EXT = ["pdf", "hwp", "hwpx", "docx"] as const;
export const ACCEPT_ATTR = ".pdf,.hwp,.hwpx,.docx";

export function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}

export function isAllowedFile(name: string): boolean {
  return (ALLOWED_EXT as readonly string[]).includes(extOf(name));
}

export function contentTypeFor(ext: string): string {
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    default:
      return "application/octet-stream";
  }
}

// 파일명/폴더명에 쓸 수 없는 문자 제거
export function safePart(s: string): string {
  return s.replace(/[\\/:*?"<>|\s]+/g, "").slice(0, 60) || "_";
}

// 학번_이름_과목_과제번호.확장자
export function ruleFileName(studentNo: string, name: string, course: string, slot: number, ext: string): string {
  return `${safePart(studentNo)}_${safePart(name)}_${safePart(course)}_과제${slot}.${ext}`;
}
