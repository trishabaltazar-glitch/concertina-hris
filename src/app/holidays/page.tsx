import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { Calendar } from "lucide-react";


export const dynamic = "force-dynamic";

export default async function HolidaysPage() {
  const session = await auth();

  if (!session || !session.user) {
    redirect("/");
  }

  const holidays = await prisma.holiday.findMany({
    orderBy: {
      date: "asc"
    }
  });

  return (
    <div className="w-full">
      <div className="overflow-hidden rounded-lg border border-border bg-background">
        <div className="divide-y divide-border">
          {holidays.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <div className="mx-auto mb-4 flex size-10 items-center justify-center rounded-md bg-muted/50">
                <Calendar className="size-6 text-muted-foreground/50" />
              </div>
              <p>No holidays have been published yet.</p>
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
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
