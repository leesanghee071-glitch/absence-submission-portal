import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { db, BUCKET } from "@/lib/supabase";
import { assertSectionAccess, jsonError, mySectionIds, requireStaff, HttpError } from "@/lib/auth";
import { EnrollmentView, loadEnrollments, missingSlots, unapprovedSlots, overallStatus } from "@/lib/data";
import { fmtDate, fmtDateTime, STATUS_LABEL } from "@/lib/format";
import { safePart } from "@/lib/files";
import { audit } from "@/lib/audit";

// kind: approved(공가 인정 엑셀, 학과장) | status(제출 현황) | missing(미제출·미승인 명단) | zip(파일 묶음 목록)
export async function GET(req: NextRequest, { params }: { params: { kind: string } }) {
  try {
    const staff = await requireStaff();
    const sectionId = req.nextUrl.searchParams.get("sectionId");
    const courseId = req.nextUrl.searchParams.get("courseId");
    const kind = params.kind;

    let list: EnrollmentView[];
    if (staff.role === "head") {
      list = await loadEnrollments(sectionId ? { sectionIds: [sectionId] } : courseId ? { courseId } : {});
    } else {
      if (kind === "approved") throw new HttpError(403, "공가 인정 엑셀은 학과장만 내려받을 수 있습니다.");
      if (sectionId) await assertSectionAccess(staff, sectionId);
      list = await loadEnrollments({ sectionIds: sectionId ? [sectionId] : await mySectionIds(staff) });
    }
    const scope = sectionId ? `section:${sectionId}` : courseId ? `course:${courseId}` : "all";
    await audit({ type: "staff", id: staff.id, label: staff.name }, `export.${kind}`, scope, { rows: list.length });

    const stamp = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }).replace(/-/g, "");
    switch (kind) {
      case "approved": {
        const rows = list
          .filter((e) => e.final_confirmed_at)
          .map((e) => ({
            과목명: e.course.name,
            분반: e.section.code,
            학번: e.student.student_no,
            이름: e.student.name,
            "공가 인정 주차": e.absence_weeks ?? "",
            "제출 과제 수": e.approvedCount,
            "승인 교수": Array.from(new Set(e.slots.map((s) => s.sub?.reviewer?.name).filter(Boolean))).join(", "),
            "최종 확인일": fmtDate(e.final_confirmed_at),
          }));
        return xlsx(rows, "공가 인정", `공가인정_${stamp}.xlsx`);
      }
      case "status": {
        const rows = list.map((e) => {
          const r: Record<string, string | number> = {
            과목명: e.course.name,
            분반: e.section.code,
            학번: e.student.student_no,
            이름: e.student.name,
          };
          for (let i = 1; i <= 3; i++) {
            const s = e.slots.find((x) => x.slot === i);
            r[`과제${i} 상태`] = s ? STATUS_LABEL[s.status] : "해당 없음";
            r[`과제${i} 제출 일시`] = s?.sub ? fmtDateTime(s.sub.submitted_at) : "";
          }
          r["전체 상태"] = overallStatus(e);
          return r;
        });
        return xlsx(rows, "제출 현황", `제출현황_${stamp}.xlsx`);
      }
      case "missing": {
        const rows = list
          .filter((e) => !e.allApproved)
          .map((e) => ({
            과목: e.course.name,
            분반: e.section.code,
            담당교수: e.professors.map((p) => p.name).join(", "),
            학번: e.student.student_no,
            이름: e.student.name,
            "미제출 과제 번호": missingSlots(e).join(", "),
            "미승인 과제 번호": unapprovedSlots(e).join(", "),
            "반려 사유": e.slots
              .filter((s) => s.status === "rejected")
              .map((s) => `과제${s.slot}: ${s.sub?.reject_reason ?? ""}`)
              .join(" / "),
          }));
        return xlsx(rows, "미제출·미승인", `미제출미승인_${stamp}.xlsx`);
      }
      case "zip": {
        // 브라우저가 직접 받아 묶을 수 있게 10분짜리 서명 링크 목록을 준다 (서버 메모리·시간 한도 회피).
        const files: { path: string; url: string; size: number }[] = [];
        const items = list.flatMap((e) =>
          e.slots
            .filter((s) => s.sub?.storage_path)
            .map((s) => ({
              path: `${safePart(e.course.name)}_${safePart(e.section.code)}분반/${safePart(e.student.student_no)}_${safePart(e.student.name)}/${s.sub!.file_name}`,
              storage: s.sub!.storage_path!,
              size: s.sub!.size_bytes,
            }))
        );
        for (let i = 0; i < items.length; i += 100) {
          const chunk = items.slice(i, i + 100);
          const { data, error } = await db().storage.from(BUCKET).createSignedUrls(chunk.map((c) => c.storage), 600);
          if (error) throw error;
          chunk.forEach((c, j) => {
            const u = data?.[j]?.signedUrl;
            if (u) files.push({ path: c.path, url: u, size: Number(c.size) });
          });
        }
        const name = sectionId || courseId ? `${safePart(list[0]?.course.name ?? "과제")}${sectionId ? `_${safePart(list[0]?.section.code ?? "")}분반` : ""}` : "전체";
        return NextResponse.json({ zipName: `과제파일_${name}_${stamp}.zip`, files });
      }
      default:
        throw new HttpError(404, "없는 자료입니다.");
    }
  } catch (e) {
    return jsonError(e);
  }
}

function xlsx(rows: Record<string, unknown>[], sheet: string, filename: string) {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 안내: "해당하는 자료가 없습니다." }]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  const buf: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
