import { Clock3, FileCheck2, ShieldCheck, UsersRound } from "lucide-react";

const rows = [
    { icon: Clock3, width: "w-32", delay: "" },
    { icon: FileCheck2, width: "w-44", delay: "[animation-delay:120ms]" },
    { icon: UsersRound, width: "w-36", delay: "[animation-delay:240ms]" },
];

export default function Loading() {
    return (
        <div className="grid min-h-[68vh] place-items-center animate-in fade-in duration-500">
            <div className="w-full max-w-3xl">
                <div className="mb-5 flex items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-semibold text-foreground">Concertina HR</p>
                        <p className="mt-1 text-xs text-muted-foreground">Loading your workspace</p>
                    </div>
                    <div className="flex items-center gap-2 rounded-md border border-border/70 bg-card px-3 py-2 text-xs font-medium text-muted-foreground shadow-sm">
                        <ShieldCheck className="size-4 text-brand-steel" />
                        Secure
                    </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm">
                    <div className="relative overflow-hidden border-b border-border/70 bg-background/50 px-5 py-5">
                        <div className="absolute inset-x-0 top-0 h-1 overflow-hidden bg-brand-steel/10">
                            <div className="h-full w-1/3 loading-sweep brand-gradient" />
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="relative grid size-14 place-items-center rounded-lg bg-card text-brand-red ring-1 ring-border/70">
                                <Clock3 className="size-6" />
                                <span className="absolute inset-2 rounded-full border border-brand-red/25 border-t-brand-red loading-orbit" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="h-3.5 w-44 rounded-full bg-muted" />
                                <div className="mt-3 grid grid-cols-3 gap-2">
                                    <span className="h-2 rounded-full bg-brand-steel loading-breathe" />
                                    <span className="h-2 rounded-full bg-brand-red loading-breathe [animation-delay:120ms]" />
                                    <span className="h-2 rounded-full bg-brand-steel loading-breathe [animation-delay:240ms]" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-4 p-5 md:grid-cols-[1.1fr_0.9fr]">
                        <div className="rounded-lg border border-border/70 bg-background/60 p-4">
                            <div className="mb-5 flex items-center justify-between">
                                <div className="h-3 w-24 rounded-full bg-muted" />
                                <div className="h-6 w-16 rounded-md bg-emerald-500/15 loading-breathe" />
                            </div>
                            <div className="mx-auto h-14 w-48 rounded-md bg-muted loading-breathe" />
                            <div className="mx-auto mt-3 h-2.5 w-36 rounded-full bg-muted/80" />
                            <div className="mt-5 h-11 overflow-hidden rounded-md bg-brand-red/15">
                                <div className="h-full w-1/3 loading-sweep bg-brand-red/30" />
                            </div>
                        </div>

                        <div className="space-y-3">
                            {rows.map(({ icon: Icon, width, delay }, index) => (
                                <div key={index} className="flex items-center gap-3 rounded-lg border border-border/70 bg-background/60 p-3">
                                    <div className="grid size-9 place-items-center rounded-md bg-muted text-muted-foreground">
                                        <Icon className="size-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className={`h-2.5 ${width} max-w-full rounded-full bg-muted loading-breathe ${delay}`} />
                                        <div className="mt-2 h-2 w-1/2 rounded-full bg-muted/80" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
