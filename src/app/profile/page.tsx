import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { updateProfile } from "@/app/actions/profile";
import { SubmitButton } from "@/components/ui/submit-button";
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

function ProfileField({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div>
      <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-semibold text-foreground">{value || "-"}</p>
    </div>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export default async function ProfilePage() {
  const session = await auth();
  const sessionUser = session?.user as any;

  if (!session || !sessionUser) {
    return <div>Unauthorized</div>;
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    include: {
      manager: true,
    },
  });

  if (!user) {
    return <div>User not found</div>;
  }

  const { firstName, lastName } = splitName(user.name);
  const initials = getInitials(user.name);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="grid gap-8 lg:grid-cols-[190px_minmax(0,1fr)]">
        <aside className="lg:border-r lg:border-border/70 lg:pr-6">
          <nav className="flex gap-2 overflow-x-auto rounded-xl border border-border/70 bg-card/60 p-1 shadow-sm lg:sticky lg:top-24 lg:flex-col lg:overflow-visible lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
            <a
              href="#overview"
              className="whitespace-nowrap rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm lg:bg-primary/10 lg:text-primary"
            >
              Overview
            </a>
            <a
              href="#personal"
              className="whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Personal
            </a>
            <a
              href="#contact"
              className="whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Contact
            </a>
            <a
              href="#employment"
              className="whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Employment
            </a>
            <a
              href="#security"
              className="whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Security
            </a>
          </nav>
        </aside>

        <div className="min-w-0 space-y-6">
          <section id="overview" className="scroll-mt-24 rounded-xl border border-border/70 bg-card shadow-sm">
            <div className="border-b border-border/70 px-6 py-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Account settings</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">My Profile</h1>
            </div>

            <div className="p-6">
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary ring-4 ring-background">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-2xl font-semibold text-foreground">{user.name}</h2>
                    <p className="mt-1 text-sm font-medium text-muted-foreground">{user.position || "Team Member"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{user.department || "Concertina HR"}</p>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 md:min-w-[320px] md:grid-cols-1">
                  <div className="rounded-lg border border-border/70 bg-background/60 px-4 py-3">
                    <p className="text-xs font-medium text-muted-foreground">Email</p>
                    <p className="mt-1 truncate text-sm font-semibold text-foreground">{user.email}</p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-background/60 px-4 py-3">
                    <p className="text-xs font-medium text-muted-foreground">Access</p>
                    <p className="mt-1 truncate text-sm font-semibold text-foreground">{user.role}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="personal" className="scroll-mt-24 rounded-xl border border-border/70 bg-card p-6 shadow-sm">
            <SectionHeader
              title="Personal information"
              description="Read-only identity details from your employee record."
            />
            <div className="mt-6 grid gap-x-12 gap-y-6 sm:grid-cols-2">
              <ProfileField label="First Name" value={firstName} />
              <ProfileField label="Last Name" value={lastName} />
              <ProfileField label="Email address" value={user.email} />
              <ProfileField label="Bio" value={user.position} />
            </div>
          </section>

          <section id="contact" className="scroll-mt-24 rounded-xl border border-border/70 bg-card p-6 shadow-sm">
            <SectionHeader
              title="Contact details"
              description="Keep your phone, emergency contact, and home address current."
            />
            <form action={updateProfile} className="mt-6 space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="contactNumber" className="text-sm font-medium text-foreground">
                    Phone
                  </label>
                  <input
                    type="text"
                    id="contactNumber"
                    name="contactNumber"
                    defaultValue={user.contactNumber || ""}
                    className="mt-2 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
                <div>
                  <label htmlFor="emergencyContact" className="text-sm font-medium text-foreground">
                    Emergency contact
                  </label>
                  <input
                    type="text"
                    id="emergencyContact"
                    name="emergencyContact"
                    defaultValue={user.emergencyContact || ""}
                    className="mt-2 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
                    placeholder="Name and number"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="address" className="text-sm font-medium text-foreground">
                  Home address
                </label>
                <textarea
                  id="address"
                  name="address"
                  defaultValue={user.address || ""}
                  rows={3}
                  className="mt-2 w-full resize-none rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
                  placeholder="123 Example St, City, Country"
                />
              </div>

              <div className="flex justify-end border-t border-border/70 pt-5">
                <SubmitButton>Save Changes</SubmitButton>
              </div>
            </form>
          </section>

          <section id="employment" className="scroll-mt-24 rounded-xl border border-border/70 bg-card p-6 shadow-sm">
            <SectionHeader
              title="Employment"
              description="Company-managed role, department, and reporting details."
            />
            <div className="mt-6 grid gap-x-12 gap-y-6 sm:grid-cols-2">
              <ProfileField label="Role / Access Level" value={user.role} />
              <ProfileField label="Department" value={user.department} />
              <ProfileField label="Position" value={user.position} />
              <ProfileField label="IC ID" value={user.icId} />
              <ProfileField label="Manager" value={user.manager?.name} />
            </div>
            <p className="mt-6 rounded-lg border border-border/70 bg-background/60 px-4 py-3 text-xs text-muted-foreground">
              Contact HR if any of your employment information is incorrect.
            </p>
          </section>

          <section id="security" className="scroll-mt-24">
            <PasswordForm />
          </section>
        </div>
      </div>
    </div>
  );
}
