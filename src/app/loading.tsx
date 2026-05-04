import { Loader2 } from "lucide-react";

export default function Loading() {
    return (
        <div className="w-full h-[60vh] flex flex-col items-center justify-center animate-in fade-in duration-500">
            <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                <Loader2 className="size-8 text-primary animate-spin" />
            </div>
            <h2 className="text-xl font-semibold text-white tracking-tight">Loading Workspace...</h2>
            <p className="text-sm text-slate-400 mt-2">Fetching the latest data securely.</p>
        </div>
    );
}
