"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { upsertSchedule } from "@/app/actions/schedules";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function ScheduleClientPage({ initialUsers }: { initialUsers: any[] }) {
    const [searchQuery, setSearchQuery] = useState("");

    const filteredUsers = initialUsers.filter(user => 
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted border border-border text-sm text-muted-foreground shrink-0">
                    <span>{filteredUsers.length} Users Found</span>
                </div>
                
                <div className="relative w-full sm:w-64 lg:w-80">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="size-4 text-muted-foreground" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search employees by name or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-background border border-input text-foreground placeholder:text-muted-foreground rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 shadow-sm transition-all"
                    />
                </div>
            </div>

            <div className="space-y-8 min-h-[400px]">
                {filteredUsers.map((user: any) => (
                    <div key={user.id} className="rounded-2xl border border-border bg-card text-card-foreground shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-border bg-muted/60 flex justify-between items-center sticky top-0 z-10 backdrop-blur-md">
                            <div>
                                <h2 className="font-semibold text-xl text-foreground">{user.name}</h2>
                                <p className="text-sm text-muted-foreground">{user.email} - {user.role}</p>
                            </div>
                        </div>
                        
                        <div className="p-4 bg-card">
                            <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                            {DAYS.map((dayName, index) => {
                                const existingSchedule = user.schedules.find((s: any) => s.dayOfWeek === index);
                                
                                return (
                                <div key={dayName} className="bg-background border border-border rounded-lg p-3">
                                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 text-center">
                                    {dayName}
                                    </div>
                                    
                                    <form action={async (formData) => {
                                        await upsertSchedule(
                                            user.id,
                                            index, 
                                            formData.get("startTime") as string, 
                                            formData.get("endTime") as string
                                        );
                                    }} className="space-y-2">
                                        <div>
                                            <input 
                                                type="time" 
                                                name="startTime" 
                                                defaultValue={existingSchedule?.startTime || ""}
                                                className="w-full bg-background border border-input text-foreground rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                                            />
                                        </div>
                                        <div className="text-center text-muted-foreground text-[10px] leading-none">to</div>
                                        <div>
                                            <input 
                                                type="time" 
                                                name="endTime" 
                                                defaultValue={existingSchedule?.endTime || ""}
                                                className="w-full bg-background border border-input text-foreground rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                                            />
                                        </div>
                                        <SubmitButton variant="default" size="xs" className="mt-2 text-[10px]">
                                            {existingSchedule ? 'Update' : 'Set'}
                                        </SubmitButton>
                                    </form>
                                </div>
                                );
                            })}
                            </div>
                        </div>
                    </div>
                ))}

                {filteredUsers.length === 0 && (
                    <div className="text-center text-muted-foreground py-12 bg-card rounded-2xl border border-border">
                        No employees found matching "{searchQuery}".
                    </div>
                )}
            </div>
        </div>
    );
}
