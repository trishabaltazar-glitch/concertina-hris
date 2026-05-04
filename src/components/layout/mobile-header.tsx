import { Menu, Clock } from "lucide-react";

export function MobileHeader() {
    return (
        <header className="lg:hidden h-16 border-b flex items-center justify-between px-4 bg-card/60 backdrop-blur-md sticky top-0 z-20">
            <div className="flex items-center gap-2">
                <div className="size-8 bg-primary rounded-xl flex items-center justify-center shadow-md">
                    <Clock className="size-4 text-primary-foreground" />
                </div>
                <span className="font-bold text-lg tracking-tight">Concertina HR</span>
            </div>
            <button className="p-2 -mr-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors">
                <Menu className="size-5" />
            </button>
        </header>
    );
}
