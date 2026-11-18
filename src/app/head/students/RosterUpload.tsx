"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, readTableFile } from "@/components/api";

type Row = {
  line: number;
  studentNo: string;
  name: string;
  birth: string | null;
  department: string;
  course: string;
  section: string;
  requiredCount: number;
  errors: string[];
  warnings: string[];
};

export default function RosterUpload() {
  const router = useRouter();
  const [payload, setPayload] = useState<{ text?: string; base64?: string } | null>(null);
  const [preview, setPreview] = useState<{ rows: Row[]; missingCols: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ studentNo: "", name: "", birth: "", department: "", course: "", section: "", requiredCount: "3" });

  const bad = preview?.rows.filter((r) => r.errors.length).length ?? 0;

  return (
    <section className="panel grid gap-4">
      <div>
        <h2 className="h2">CSV 명단 업로드</h2>
        <p className="text-sm mb-2">
          필수 열: <code>학번, 이름, 생년월일, 학과, 과목, 분반</code> · 선택 열: <code>공가주차</code> (1~3, 그 학생이 낼 과제 수. 비우면 3). 한 학생이 여러 과목이면 행을 여러 개 둡니다. 엑셀에서 저장한 CSV(한글 인코딩)와 xlsx도 됩니다.
        </p>
        <input
          type="file"
          accept=".csv,.xlsx"
          className="text-sm"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setBusy(true);
            try {
              const p = await readTableFile(f);
              setPayload(p);
              setPreview(await api("/api/head/roster/preview", "POST", p));
            } catch (err) {
              alert(err instanceof Error ? err.message : "점검 실패");
            } finally {
              setBusy(false);
            }
          }}
        />
        {preview && (
          <div className="mt-3 overflow-x-auto">
            {preview.missingCols.length > 0 ? (
              <p className="text-correction text-sm">필수 열이 없습니다: {preview.missingCols.join(", ")}. 열 이름을 확인해 주세요.</p>
            ) : (
              <p className="text-sm mb-2">
                {preview.rows.length}행 점검 — 오류 <b className="text-correction">{bad}</b>행 (반영 시 건너뜀)
              </p>
            )}
            <div className="max-h-96 overflow-y-auto border border-line rounded">
              <table className="tbl">
                <thead className="sticky top-0 bg-sheet">
                  <tr>
                    <th>행</th>
                    <th>학번</th>
                    <th>이름</th>
                    <th>생년월일</th>
                    <th>학과</th>
                    <th>과목</th>
                    <th>분반</th>
                    <th>공가주차</th>
                    <th>점검</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r) => (
                    <tr key={r.line} className={r.errors.length ? "bg-correction-soft" : r.warnings.length ? "bg-amber-soft/50" : ""}>
                      <td>{r.line}</td>
                      <td>{r.studentNo}</td>
                      <td>{r.name}</td>
                      <td>{r.birth ? `${r.birth.slice(0, 4)}-${r.birth.slice(4, 6)}-${r.birth.slice(6)}` : ""}</td>
                      <td>{r.department}</td>
                      <td>{r.course}</td>
                      <td>{r.section}</td>
                      <td>{r.requiredCount}주</td>
                      <td className="text-xs">{[...r.errors, ...r.warnings].join(", ") || "정상"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 mt-2">
              <button
                className="btn-primary"
                disabled={busy || preview.missingCols.length > 0 || bad === preview.rows.length}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const r = await api<{ students: number; enrollments: number; skipped: number }>("/api/head/roster/commit", "POST", payload);
                    alert(`학생 ${r.students}명, 과목·분반 ${r.enrollments}건 반영 (건너뜀 ${r.skipped}행). 업로드한 원본 파일은 저장하지 않았습니다.`);
                    setPreview(null);
                    setPayload(null);
                    router.refresh();
                  } catch (err) {
                    alert(err instanceof Error ? err.message : "반영 실패");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                확인 — {preview.rows.length - bad}행 반영
              </button>
              <button className="btn" onClick={() => (setPreview(null), setPayload(null))}>
                취소
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-line pt-4">
        <h2 className="h2">학생 한 명 추가</h2>
        <p className="text-sm text-ink-soft mb-2">이미 있는 학번이면 정보를 갱신하고 과목·분반을 추가합니다.</p>
        <form
          className="grid grid-cols-2 md:grid-cols-4 gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api("/api/head/students", "POST", form);
              setForm({ ...form, studentNo: "", name: "", birth: "", requiredCount: "3" });
              router.refresh();
            } catch (err) {
              alert(err instanceof Error ? err.message : "추가 실패");
            } finally {
              setBusy(false);
            }
          }}
        >
          <input className="input" placeholder="학번" value={form.studentNo} onChange={(e) => setForm({ ...form, studentNo: e.target.value })} required />
          <input className="input" placeholder="이름" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="input" placeholder="생년월일 (20030507)" value={form.birth} onChange={(e) => setForm({ ...form, birth: e.target.value })} required />
          <input className="input" placeholder="학과" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} required />
          <input className="input" placeholder="과목" value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} required />
          <input className="input" placeholder="분반 (예: 01)" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} required />
          <select className="input" value={form.requiredCount} onChange={(e) => setForm({ ...form, requiredCount: e.target.value })} title="공가 주차 = 제출할 과제 수">
            {[1, 2, 3].map((n) => (
              <option key={n} value={n}>
                공가 {n}주 (과제 {n}개)
              </option>
            ))}
          </select>
          <button className="btn-primary" disabled={busy}>
            추가
          </button>
        </form>
      </div>
    </section>
  );
}
