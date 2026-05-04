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
    <div className="max-w-5xl mx-auto space-y-8 py-8 px-4">
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="rounded-2xl border bg-card text-card-foreground shadow-sm p-6 sticky top-24">
            <h2 className="font-semibold text-xl mb-4">Add Holiday</h2>
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
                  className="w-full bg-[#1A1D27] border border-slate-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
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
                  className="w-full bg-[#1A1D27] border border-slate-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div>
                <label htmlFor="type" className="block text-sm font-medium mb-1.5">
                  Holiday Type
                </label>
                <select
                  id="type"
                  name="type"
                  className="w-full bg-[#1A1D27] border border-slate-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none"
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
                  className="w-full bg-[#1A1D27] border border-slate-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  placeholder="Additional details..."
                />
              </div>

              <div className="pt-2">
                <SubmitButton className="w-full">
                  Create Holiday
                </SubmitButton>
              </div>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden h-full">
            <div className="p-6 border-b flex justify-between items-center bg-card/50">
              <h2 className="font-semibold text-xl">Upcoming Holidays</h2>
              <div className="flex items-center gap-2 text-primary font-medium bg-primary/10 px-3 py-1.5 rounded-full text-sm">
                <Calendar className="size-4" />
                {new Date().getFullYear()} Calendar
              </div>
            </div>

            <div className="divide-y divide-border">
              {holidays.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted/50 mb-4">
                    <Calendar className="size-6 text-muted-foreground/50" />
                  </div>
                  <p>No holidays entered yet.</p>
                </div>
              ) : (
                holidays.map((holiday: any) => (
                  <div key={holiday.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="bg-[#1A1D27] border border-slate-800 rounded-xl px-4 py-3 flex flex-col items-center justify-center min-w-[5rem] shadow-sm">
                        <span className="text-xs font-bold uppercase text-primary mb-1 tracking-widest">{format(holiday.date, "MMM")}</span>
                        <span className="text-2xl font-bold text-white leading-none">{format(holiday.date, "d")}</span>
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-white group-hover:text-primary transition-colors">{holiday.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${
                            holiday.type === 'REGULAR' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                            holiday.type === 'SPECIAL_NON_WORKING' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                            'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                          }`}>
                            {holiday.type.replace(/_/g, " ")}
                          </span>
                        </div>
                        {holiday.description && (
                          <p className="text-sm text-slate-400 mt-2 line-clamp-2">{holiday.description}</p>
                        )}
                      </div>
                    </div>
                    
                    <form action={async () => {
                      "use server";
                      await deleteHoliday(holiday.id);
                    }}>
                      <SubmitButton variant="outline" className="text-destructive hover:bg-destructive hover:text-white border-destructive text-xs h-8">
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
