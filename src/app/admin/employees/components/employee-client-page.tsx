"use client";

import { useState } from "react";
import { Plus, UserCog, User, ShieldAlert, Search, Trash2, Loader2 } from "lucide-react";
import { AddEmployeeForm } from "./add-employee-form";
import { deleteEmployee } from "@/app/actions/employees";

type EmployeeData = {
    id: string;
    name: string;
    email: string;
    role: string;
    leaveBalance: number;
    joined: string;
};

export function EmployeeClientPage({ initialUsers }: { initialUsers: EmployeeData[] }) {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [employeeToDelete, setEmployeeToDelete] = useState<EmployeeData | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const filteredUsers = initialUsers.filter(user => 
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleDelete = async () => {
        if (!employeeToDelete) return;
        setIsDeleting(true);
        try {
            const res = await deleteEmployee(employeeToDelete.id);
            if (res.success) {
                setEmployeeToDelete(null);
            } else {
                alert(res.error);
            }
        } catch (error) {
            alert("Failed to delete employee.");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-sm text-slate-300 shrink-0">
                        <UserCog className="size-4" />
                        <span>{filteredUsers.length} Team Members</span>
                    </div>
                    
                    <div className="relative w-full sm:w-64 lg:w-80">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="size-4 text-slate-500" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search employees..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-[#1A1D27] border border-slate-700 text-white rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm transition-all"
                        />
                    </div>
                </div>
                
                <button 
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-white text-black rounded-lg hover:bg-slate-200 transition-colors shadow-sm shrink-0"
                >
                    <Plus className="size-4" />
                    Add Employee
                </button>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#11131A] overflow-hidden shadow-sm min-h-[400px]">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 border-b border-slate-800 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Employee</th>
                                <th className="px-6 py-4 font-semibold">Role</th>
                                <th className="px-6 py-4 font-semibold text-center">PFFD Balance</th>
                                <th className="px-6 py-4 font-semibold text-right">Joined</th>
                                <th className="px-6 py-4 font-semibold text-right w-16"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {filteredUsers.map((user) => (
                                <tr key={user.id} className="hover:bg-slate-800/20 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="size-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                                                {user.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-white">{user.name}</div>
                                                <div className="text-xs text-slate-500">{user.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                                            user.role === 'ADMIN' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                            user.role === 'MANAGER' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                            'bg-slate-800 text-slate-300 border-slate-700'
                                        }`}>
                                            {user.role === 'ADMIN' ? <ShieldAlert className="size-3" /> : <User className="size-3" />}
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="font-mono font-medium text-emerald-400">
                                            {user.leaveBalance}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right text-slate-400 whitespace-nowrap">
                                        {user.joined}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => setEmployeeToDelete(user)}
                                            className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                            title="Delete Employee"
                                        >
                                            <Trash2 className="size-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    
                    {filteredUsers.length === 0 && (
                        <div className="p-12 text-center text-slate-500">
                            No employees found matching "{searchQuery}".
                        </div>
                    )}
                </div>
            </div>

            {/* Add Employee Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div 
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in" 
                        onClick={() => setIsAddModalOpen(false)}
                    />
                    <div className="relative bg-[#11131A] border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
                        <div className="mb-6">
                            <h2 className="text-xl font-bold text-white">Add New Employee</h2>
                            <p className="text-sm text-slate-400 mt-1">
                                Enter details and migrate their starting PFFD balance from Sprout. A one-time account setup link will be generated after creation.
                            </p>
                        </div>
                        
                        <AddEmployeeForm onSuccess={() => setIsAddModalOpen(false)} />
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {employeeToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div 
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in" 
                        onClick={() => !isDeleting && setEmployeeToDelete(null)}
                    />
                    <div className="relative bg-[#11131A] border border-red-500/20 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
                        <div className="mb-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-red-500/10 text-red-500 rounded-full">
                                    <Trash2 className="size-5" />
                                </div>
                                <h2 className="text-xl font-bold text-white">Delete Employee</h2>
                            </div>
                            <p className="text-sm text-slate-400">
                                Are you absolutely sure you want to delete <strong className="text-white">{employeeToDelete.name}</strong>?
                            </p>
                            <p className="text-xs text-red-400 mt-2 p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                                This action is destructive. It will permanently delete their account along with all their historical time logs, schedules, and leave requests.
                            </p>
                        </div>
                        
                        <div className="flex items-center justify-end gap-3">
                            <button
                                onClick={() => setEmployeeToDelete(null)}
                                disabled={isDeleting}
                                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-800/50 hover:bg-slate-800 rounded-lg transition-colors border border-slate-700 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50"
                            >
                                {isDeleting ? (
                                    <>
                                        <Loader2 className="size-4 animate-spin" />
                                        Deleting...
                                    </>
                                ) : (
                                    "Yes, Delete Account"
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
