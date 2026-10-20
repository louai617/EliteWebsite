import { requireUser } from "@/lib/auth/session";
import { CLIENT_APP_URL } from "@/lib/env";
import { AppShell } from "@/components/layout/app-shell";
import { DevDbNotice } from "@/components/layout/dev-db-notice";

export default async function CrmLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  return (
    <AppShell user={user} websiteUrl={CLIENT_APP_URL}>
      <DevDbNotice />
      {children}
    </AppShell>
  );
}
