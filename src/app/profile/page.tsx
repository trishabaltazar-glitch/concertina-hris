import {
  AtSign,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ContactRound,
  Fingerprint,
  IdCard,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";

import { updateProfile } from "@/app/actions/profile";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import prisma from "@/lib/prisma";
import { PasswordForm } from "./components/password-form";

function splitName(name: string) {
  const parts = name.trim().split(/\s+/);
  return {
    firstName: parts[0] || name,
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : "-",
  };
}

function getInitials(name: string) {
  const letters = name
    .replace(/\([^)]*\)/g, "")
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("");

  return letters.toUpperCase() || "CH";
}

function getRoleLabel(role: string | null | undefined) {
  if (!role) return "Employee";
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

function formatProfileDate(value: Date | null | undefined) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(value);
}

function ProfileField({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value?: string | null;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex gap-3 border-b border-border/70 py-3 last:border-b-0">
      <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-sm font-semibold text-foreground">{value || "-"}</p>
      </div>
    </div>
  );
}

function EditableField({
  label,
  name,
  value,
  placeholder,
}: {
  label: string;
  name: string;
  value?: string | null;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      <input
        name={name}
        defaultValue={value || ""}
        placeholder={placeholder}
        className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/25"
      />
    </label>
  );
}

function SectionTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

export default async function ProfilePage() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return <div>Unauthorized</div>;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      manager: true,
    },
  });

  if (!user) {
    return <div>User not found</div>;
  }

  const { firstName, lastName } = splitName(user.name);
  const initials = getInitials(user.name);
  const roleLabel = getRoleLabel(user.role);

  return (
    <div className="w-full space-y-5">
      <header>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Account settings</p>
          <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-foreground">My Profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">Review your employee record, contact details, and account security.</p>
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <section className="rounded-lg border border-border bg-background p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex size-20 shrink-0 items-center justify-center rounded-full bg-primary/10 text-2xl font-semibold text-primary ring-4 ring-muted/30">
                {initials}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold text-foreground">{user.name}</h2>
                <p className="mt-1 truncate text-sm font-medium text-muted-foreground">{user.position || "Team member"}</p>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">{user.department || "Concertina HR"}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-2 border-t border-border pt-4">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="size-4 text-muted-foreground" />
                <span className="min-w-0 truncate font-medium text-foreground">{user.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <BriefcaseBusiness className="size-4 text-muted-foreground" />
                <span className="min-w-0 truncate text-muted-foreground">
                  {roleLabel} {user.icId ? `- ${user.icId}` : ""}
                </span>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-background p-5 shadow-sm">
            <SectionTitle title="Identity" description="Core account details from your employee profile." />
            <div className="mt-4 grid gap-3">
              <ProfileField label="First name" value={firstName} icon={UserRound} />
              <ProfileField label="Last name" value={lastName} icon={ContactRound} />
              <ProfileField label="Email" value={user.email} icon={AtSign} />
            </div>
          </section>
        </aside>

        <div className="min-w-0 space-y-5">
          <section className="rounded-lg border border-border bg-background p-5 shadow-sm">
            <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
              <SectionTitle
                title="Contact details"
                description="Keep your reachable phone, emergency contact, and address updated."
              />
            </div>

            <form action={updateProfile} className="mt-5 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <EditableField label="Phone" name="contactNumber" value={user.contactNumber} placeholder="Add phone number" />
                <EditableField
                  label="Emergency contact"
                  name="emergencyContact"
                  value={user.emergencyContact}
                  placeholder="Name and phone number"
                />
              </div>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Home address</span>
                <textarea
                  name="address"
                  defaultValue={user.address || ""}
                  placeholder="Add home address"
                  rows={3}
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/25"
                />
              </label>
              <div className="flex justify-end">
                <Button type="submit" className="min-w-36">
                  Save contact info
                </Button>
              </div>
            </form>
          </section>

          <section className="rounded-lg border border-border bg-background p-5 shadow-sm">
            <SectionTitle title="Employment" description="Company-managed role, team, and reporting details." />
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <ProfileField label="Role / access" value={roleLabel} icon={ShieldCheck} />
              <ProfileField label="Department" value={user.department} icon={Building2} />
              <ProfileField label="Position" value={user.position} icon={BriefcaseBusiness} />
              <ProfileField label="Date hired" value={formatProfileDate(user.dateHired)} icon={CalendarDays} />
              <ProfileField label="IC ID" value={user.icId} icon={IdCard} />
              <ProfileField label="Manager" value={user.manager?.name} icon={UsersRound} />
              <ProfileField label="Record ID" value={user.id} icon={Fingerprint} />
            </div>
            <p className="mt-4 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
              Employment details are managed by admins. Contact HR if these values need correction.
            </p>
          </section>

          <section className="rounded-lg border border-border bg-background p-5 shadow-sm">
            <SectionTitle title="Location snapshot" description="Quick reference from your saved contact information." />
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <ProfileField label="Phone" value={user.contactNumber} icon={Phone} />
              <ProfileField label="Address" value={user.address} icon={MapPin} />
            </div>
          </section>

          <PasswordForm />
        </div>
      </div>
    </div>
  );
}
