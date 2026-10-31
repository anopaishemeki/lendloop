import { AdminAutomation } from "@/components/admin/admin-automation";
import { AdminPageHeader } from "@/components/admin/admin-shell";

export default function AdminAutomationPage() {
  return (
    <>
      <AdminPageHeader
        description="Emails sent through n8n, so a failed delivery is never silent."
        title="Automation"
      />
      <AdminAutomation />
    </>
  );
}
