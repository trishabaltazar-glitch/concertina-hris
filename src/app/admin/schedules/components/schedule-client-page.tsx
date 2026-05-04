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
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-sm text-slate-300 shrink-0">
                    <span>{filteredUsers.length} Users Found</span>
                </div>
                
                <div className="relative w-full sm:w-64 lg:w-80">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="size-4 text-slate-500" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search employees by name or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[#1A1D27] border border-slate-700 text-white rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm transition-all"
                    />
                </div>
            </div>

            <div className="space-y-8 min-h-[400px]">
                {filteredUsers.map((user: any) => (
                    <div key={user.id} className="rounded-2xl border border-slate-800 bg-[#11131A] text-card-foreground shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center sticky top-0 z-10 backdrop-blur-md">
                            <div>
                                <h2 className="font-semibold text-xl text-white">{user.name}</h2>
                                <p className="text-sm text-slate-400">{user.email} • {user.role}</p>
                            </div>
                        </div>
                        
                        <div className="p-4 bg-[#11131A]">
                            <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                            {DAYS.map((dayName, index) => {
                                const existingSchedule = user.schedules.find((s: any) => s.dayOfWeek === index);
                                
                                return (
                                <div key={dayName} className="bg-[#1A1D27] border border-slate-700/50 rounded-lg p-3">
                                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 text-center">
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
                                                className="w-full bg-slate-900 border border-slate-700 text-white rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                            />
                                        </div>
                                        <div className="text-center text-slate-600 text-[10px] leading-none">to</div>
                                        <div>
                                            <input 
                                                type="time" 
                                                name="endTime" 
                                                defaultValue={existingSchedule?.endTime || ""}
                                                className="w-full bg-slate-900 border border-slate-700 text-white rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                            />
                                        </div>
                                        <SubmitButton variant="default" className="w-full h-7 text-[10px] mt-2 py-0 px-0 bg-white text-black hover:bg-slate-200">
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
                    <div className="text-center text-slate-500 py-12 bg-[#11131A] rounded-2xl border border-slate-800">
                        No employees found matching "{searchQuery}".
                    </div>
                )}
            </div>
        </div>
    );
}
