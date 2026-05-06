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
    <div className="max-w-5xl mx-auto space-y-8 py-8 px-4">
      <div className="rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden h-full">
        <div className="divide-y divide-border">
          {holidays.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted/50 mb-4">
                <Calendar className="size-6 text-muted-foreground/50" />
              </div>
              <p>No holidays have been published yet.</p>
            </div>
          ) : (
            holidays.map((holiday: any) => (
              <div key={holiday.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="bg-background border border-border rounded-xl px-4 py-3 flex flex-col items-center justify-center min-w-[5rem] shadow-sm">
                    <span className="text-xs font-bold uppercase text-primary mb-1 tracking-widest">{format(holiday.date, "MMM")}</span>
                    <span className="text-2xl font-bold text-foreground leading-none">{format(holiday.date, "d")}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">{holiday.name}</h3>
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
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{holiday.description}</p>
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
