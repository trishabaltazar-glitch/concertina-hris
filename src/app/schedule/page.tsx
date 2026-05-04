import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { CalendarDays, Clock } from "lucide-react";


export const dynamic = "force-dynamic";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function UserSchedulePage() {
  const session = await auth();

  if (!session || !session.user || !session.user.id) {
    redirect("/");
  }

  const userId = session.user.id;

  const schedules = await prisma.schedule.findMany({
    where: { userId },
    orderBy: { dayOfWeek: "asc" }
  });

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-8 px-4">
      <div className="rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden h-full">
        <div className="p-6 border-b flex justify-between items-center bg-card/50">
          <h2 className="font-semibold text-xl">Standard Hours</h2>
          <div className="flex items-center gap-2 text-brand-red font-medium bg-brand-red/10 px-3 py-1.5 rounded-full text-sm">
            <CalendarDays className="size-4" />
            7-Day View
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {DAYS.map((dayName, index) => {
              const schedule = schedules.find((s: any) => s.dayOfWeek === index);
              const isToday = new Date().getDay() === index;

              return (
                <div 
                  key={dayName} 
                  className={`border rounded-xl p-5 relative overflow-hidden transition-all ${
                    isToday 
                      ? 'bg-brand-red/5 border-brand-red shadow-brand-red/20' 
                      : 'bg-[#1A1D27] border-slate-800'
                  }`}
                >
                  {isToday && (
                    <div className="absolute top-0 right-0 bg-brand-red text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-bl-lg z-10">
                      Today
                    </div>
                  )}
                  
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`size-10 rounded-lg flex items-center justify-center ${isToday ? 'bg-brand-red text-white' : 'bg-slate-800 text-slate-400'}`}>
                      <CalendarDays className="size-5" />
                    </div>
                    <div className="font-semibold text-lg text-white">{dayName}</div>
                  </div>

                  <div className="space-y-3">
                    {schedule ? (
                      <div className="flex items-center gap-2 text-slate-300">
                        <Clock className="size-4 text-primary" />
                        <span className="font-medium text-sm">
                          {format(new Date(`1970-01-01T${schedule.startTime}`), "h:mm a")} - {format(new Date(`1970-01-01T${schedule.endTime}`), "h:mm a")}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-slate-500 italic">
                        <Clock className="size-4 opacity-50" />
                        <span className="text-sm">Off Duty</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
