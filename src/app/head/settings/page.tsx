import { getSettings } from "@/lib/settings";
import StaffHeader, { loadStaffForPage } from "@/components/StaffHeader";
import SettingsForm from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const staff = await loadStaffForPage({ head: true });
  const settings = await getSettings();
  return (
    <>
      <StaffHeader staff={staff} />
      <main className="max-w-3xl mx-auto px-4 py-6 grid gap-5">
        <h1 className="h1">설정</h1>
        <SettingsForm settings={settings} />
      </main>
    </>
  );
}
