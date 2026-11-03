import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { ROLE_META } from "@/lib/constants";
import { getSettings } from "@/services/settings";
import { countPendingWatermarks } from "@/services/photo-watermark-job";
import { recentEmails } from "@/services/mail";
import { MAIL, mailConfigured } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { CompanySettingsForm, PasswordForm, PaymentSettingsForm, ProfileForm, SendTestEmailButton, WatermarkSettingsForm } from "@/components/settings/settings-forms";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const admin = can.editSettings(user);
  const [profile, settings, managers, emails, pendingWatermarks] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { name: true, phone: true, avatarUrl: true, email: true, role: true } }),
    getSettings(),
    db.user.findMany({ where: { isActive: true, role: { in: ["ADMIN", "MANAGER"] } }, orderBy: { name: "asc" }, select: { id: true, name: true, role: true } }),
    admin ? recentEmails(8) : Promise.resolve([]),
    admin ? countPendingWatermarks() : Promise.resolve(0),
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
            <CardDescription>Defaults used for deal commission and lead response tasks.</CardDescription>
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
                leadResponseSlaMinutes: settings.leadResponseSlaMinutes,
                autoLeadResponseTasks: settings.autoLeadResponseTasks,
                leadAutoReassignHours: settings.leadAutoReassignHours,
                leadEscalationUserId: settings.leadEscalationUserId,
              }}
              escalationOptions={managers.map((m) => ({ value: m.id, label: `${m.name} (${ROLE_META[m.role].label})` }))}
            />
          </CardContent>
        </Card>
        <Card id="payments">
          <CardHeader className="flex-col">
            <CardTitle>Reservations &amp; payments</CardTitle>
            <CardDescription>How clients pay the booking deposit when they reserve a home on the website.</CardDescription>
          </CardHeader>
          <CardContent>
            <PaymentSettingsForm
              editable={admin}
              settings={{
                fawranEnabled: settings.fawranEnabled,
                saleDepositPercent: settings.saleDepositPercent,
                rentDepositMonths: settings.rentDepositMonths,
                reservationHoldHours: settings.reservationHoldHours,
                bankName: settings.bankName ?? "",
                bankAccountName: settings.bankAccountName ?? "",
                bankIban: settings.bankIban ?? "",
                bankAccountNumber: settings.bankAccountNumber ?? "",
                bankSwift: settings.bankSwift ?? "",
                fawranAlias: settings.fawranAlias ?? "",
                paymentInstructions: settings.paymentInstructions ?? "",
              }}
            />
          </CardContent>
        </Card>
        <Card id="watermark">
          <CardHeader className="flex-col">
            <CardTitle>Photo watermark</CardTitle>
            <CardDescription>Stamped on every listing photo shown on the website.</CardDescription>
          </CardHeader>
          <CardContent>
            <WatermarkSettingsForm
              editable={admin}
              pending={pendingWatermarks}
              settings={{
                watermarkEnabled: settings.watermarkEnabled,
                watermarkPosition: settings.watermarkPosition,
                watermarkSize: settings.watermarkSize,
                watermarkOpacity: settings.watermarkOpacity,
              }}
            />
          </CardContent>
        </Card>
        {admin && (
          <Card id="email">
            <CardHeader className="flex-col">
              <CardTitle>E-mail</CardTitle>
              <CardDescription>
                Password codes, booking and reservation e-mails.{" "}
                {mailConfigured() ? (
                  <>
                    Sending through <span className="font-medium text-foreground">{MAIL.host}</span> as {MAIL.from}.
                  </>
                ) : (
                  <>SMTP is not set up — in development, e-mails are saved to <code>storage/outbox</code>. Set SMTP_HOST, SMTP_USER and SMTP_PASS in the server environment.</>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <SendTestEmailButton />
              {emails.length > 0 && (
                <ul className="divide-y rounded-md border text-sm">
                  {emails.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                      <Badge tone={e.status === "SENT" ? "green" : e.status === "OUTBOX" ? "blue" : "red"}>{e.status === "OUTBOX" ? "Outbox" : e.status === "SENT" ? "Sent" : "Failed"}</Badge>
                      <span className="min-w-0 flex-1 truncate">{e.subject}</span>
                      <span className="text-xs text-muted-foreground">
                        {e.to} · {formatDateTime(e.createdAt)}
                      </span>
                      {e.error && <span className="w-full text-xs text-rose-700">{e.error}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
