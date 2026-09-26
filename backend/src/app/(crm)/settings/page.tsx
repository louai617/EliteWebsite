import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { ROLE_META } from "@/lib/constants";
import { getSettings } from "@/services/settings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { CompanySettingsForm, PasswordForm, ProfileForm } from "@/components/settings/settings-forms";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const [profile, settings] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { name: true, phone: true, avatarUrl: true, email: true, role: true } }),
    getSettings(),
  ]);

  return (
    <>
      <PageHeader title="Settings" description={`${profile.email} · ${ROLE_META[profile.role].label}`} />
      <div className="grid max-w-4xl gap-5">
        <Card>
          <CardHeader className="flex-col">
            <CardTitle>Profile</CardTitle>
            <CardDescription>Shown on records you own and in the activity log.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm profile={profile} />
          </CardContent>
        </Card>
        <Card id="security">
          <CardHeader className="flex-col">
            <CardTitle>Password &amp; security</CardTitle>
            <CardDescription>Changing your password signs out every other device.</CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordForm />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-col">
            <CardTitle>Company &amp; commission</CardTitle>
            <CardDescription>Defaults used when calculating deal commission.</CardDescription>
          </CardHeader>
          <CardContent>
            <CompanySettingsForm
              editable={can.editSettings(user)}
              settings={{
                companyName: settings.companyName,
                defaultCurrency: settings.defaultCurrency,
                saleCommissionPercent: settings.saleCommissionPercent,
                rentalCommissionPercent: settings.rentalCommissionPercent,
                agentSharePercent: settings.agentSharePercent,
              }}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
