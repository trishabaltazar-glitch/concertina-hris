import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { createHoliday, deleteHoliday } from "@/app/actions/holidays";
import { SubmitButton } from "@/components/ui/submit-button";
import { Calendar } from "lucide-react";


export const dynamic = "force-dynamic";

export default async function AdminHolidaysPage() {
  const session = await auth();
  const sessionUser = session?.user as any;

  if (!session || !sessionUser || (sessionUser.role !== "ADMIN" && sessionUser.role !== "MANAGER")) {
    redirect("/");
  }

  const holidays = await prisma.holiday.findMany({
    orderBy: {
      date: "asc"
    }
  });

  return (
    <div className="w-full">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <div className="sticky top-24 rounded-lg border border-border bg-background p-4">
            <h2 className="mb-4 font-semibold">Add Holiday</h2>
            <form action={createHoliday} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-1.5">
                  Holiday Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  placeholder="e.g. New Year's Day"
                  className="w-full bg-background border border-input text-foreground placeholder:text-muted-foreground rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-ring/50"
                />
              </div>

              <div>
                <label htmlFor="date" className="block text-sm font-medium mb-1.5">
                  Date
                </label>
                <input
                  type="date"
                  id="date"
                  name="date"
                  required
                  className="w-full bg-background border border-input text-foreground rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-ring/50"
                />
              </div>

              <div>
                <label htmlFor="type" className="block text-sm font-medium mb-1.5">
                  Holiday Type
                </label>
                <select
                  id="type"
                  name="type"
                  className="w-full bg-background border border-input text-foreground rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-ring/50 appearance-none"
                >
                  <option value="REGULAR">Regular Holiday</option>
                  <option value="SPECIAL_NON_WORKING">Special Non-Working Holiday</option>
                  <option value="COMPANY_OBSERVED">Company Observed</option>
                </select>
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium mb-1.5">
                  Description <span className="text-xs text-muted-foreground">(Optional)</span>
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={2}
                  className="w-full bg-background border border-input text-foreground placeholder:text-muted-foreground rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none"
                  placeholder="Additional details..."
                />
              </div>

              <div className="pt-2">
                <SubmitButton size="sm" className="w-full">
                  Create Holiday
                </SubmitButton>
              </div>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="h-full overflow-hidden rounded-lg border border-border bg-background">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="font-semibold">Upcoming Holidays</h2>
              <div className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">
                <Calendar className="size-4" />
                {new Date().getFullYear()} Calendar
              </div>
            </div>

            <div className="divide-y divide-border">
              {holidays.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <div className="mx-auto mb-4 flex size-10 items-center justify-center rounded-md bg-muted/50">
                    <Calendar className="size-6 text-muted-foreground/50" />
                  </div>
                  <p>No holidays entered yet.</p>
                </div>
              ) : (
                holidays.map((holiday: any) => (
                  <div key={holiday.id} className="flex flex-col justify-between gap-4 p-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center">
                    <div className="flex items-start gap-4">
                      <div className="flex min-w-16 flex-col items-center justify-center rounded-lg border border-border bg-background px-3 py-2">
                        <span className="mb-1 text-xs font-bold uppercase tracking-widest text-primary">{format(holiday.date, "MMM")}</span>
                        <span className="text-xl font-bold leading-none text-foreground">{format(holiday.date, "d")}</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{holiday.name}</h3>
                        <div className="mt-1 flex items-center gap-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${
                            holiday.type === 'REGULAR' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                            holiday.type === 'SPECIAL_NON_WORKING' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                            'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                          }`}>
                            {holiday.type.replace(/_/g, " ")}
                          </span>
                        </div>
                        {holiday.description && (
                          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{holiday.description}</p>
                        )}
                      </div>
                    </div>
                    
                    <form action={async () => {
                      "use server";
                      await deleteHoliday(holiday.id);
                    }}>
                      <SubmitButton variant="destructive-outline" size="sm" className="text-xs">
                        Delete
                      </SubmitButton>
                    </form>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
