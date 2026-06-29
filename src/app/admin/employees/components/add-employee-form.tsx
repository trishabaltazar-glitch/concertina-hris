"use client";

import { useState } from "react";
import { addEmployee } from "@/app/actions/employees";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type ManagerOption = {
    id: string;
    name: string;
    email: string;
};

type AddEmployeeResult = {
    success: boolean;
    error?: string;
    inviteLink?: string;
    emailSent?: boolean;
};

export function AddEmployeeForm({ managers, onSuccess }: { managers: ManagerOption[]; onSuccess: () => void }) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [inviteLink, setInviteLink] = useState<string | null>(null);
    const [emailSent, setEmailSent] = useState(false);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        const formData = new FormData(e.currentTarget);
        const result: AddEmployeeResult = await addEmployee(formData);

        if (result.success) {
            setInviteLink(result.inviteLink || null);
            setEmailSent(!!result.emailSent);
            setIsLoading(false);
        } else {
            setError(result.error || "Failed to add employee.");
            setIsLoading(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
                <div className="p-3 text-sm text-red-500 bg-red-500/10 rounded-lg border border-red-500/20">
                    {error}
                </div>
            )}

            {inviteLink && (
                <div className="p-3 text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 rounded-lg border border-emerald-500/20 space-y-2">
                    <p className="font-medium">
                        {emailSent
                            ? "Employee created and setup email sent."
                            : "Employee created. Email was not sent, so share this one-time setup link:"}
                    </p>
                    <p className="break-all text-xs text-emerald-800 dark:text-emerald-200">{inviteLink}</p>
                </div>
            )}
            
            <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Full Name</label>
                <input 
                    name="name" 
                    required 
                    className="w-full bg-background border border-input text-foreground placeholder:text-muted-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50" 
                    placeholder="Jane Doe" 
                />
            </div>

            <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email Address</label>
                <input 
                    name="email" 
                    type="email" 
                    required 
                    className="w-full bg-background border border-input text-foreground placeholder:text-muted-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50" 
                    placeholder="jane.doe@company.com" 
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">System Role</label>
                    <select 
                        name="role" 
                        className="w-full bg-background border border-input text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 appearance-none"
                    >
                        <option value="EMPLOYEE">Employee</option>
                        <option value="MANAGER">Manager</option>
                        <option value="ADMIN">Admin</option>
                    </select>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Starting PFFD</label>
                    <input 
                        name="pffdBalance" 
                        type="number" 
                        required 
                        min="0"
                        defaultValue="0"
                        className="w-full bg-background border border-input text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50" 
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Department</label>
                    <input
                        name="department"
                        className="w-full bg-background border border-input text-foreground placeholder:text-muted-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                        placeholder="Operations"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Position</label>
                    <input
                        name="position"
                        className="w-full bg-background border border-input text-foreground placeholder:text-muted-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                        placeholder="Team Lead"
                    />
                </div>
            </div>

            <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Date Hired</label>
                <input
                    name="dateHired"
                    type="date"
                    className="w-full bg-background border border-input text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                />
            </div>

            <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Manager</label>
                <select
                    name="managerId"
                    className="w-full bg-background border border-input text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                >
                    <option value="">No manager</option>
                    {managers.map((manager) => (
                        <option key={manager.id} value={manager.id}>
                            {manager.name} ({manager.email})
                        </option>
                    ))}
                </select>
            </div>

            <div className="pt-4 flex justify-end gap-3">
                <Button
                    type="button" 
                    variant="ghost"
                    onClick={onSuccess}
                >
                    Cancel
                </Button>
                <Button
                    type="submit" 
                    disabled={isLoading}
                >
                    {isLoading && <Loader2 className="size-4 animate-spin" />}
                    {isLoading ? "Adding..." : inviteLink ? "Create Another" : "Add Employee"}
                </Button>
            </div>
        </form>
    );
}
