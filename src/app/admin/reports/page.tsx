"use client";

import { useState } from "react";
import { format, subDays } from "date-fns";
import { Download, FileSpreadsheet, Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { generateTimesheetReport, generateLeaveReport } from "@/app/actions/reports";

export default function AdminReportsPage() {
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isExportingTimesheets, setIsExportingTimesheets] = useState(false);
  const [isExportingLeaves, setIsExportingLeaves] = useState(false);
  const [isExportingPayroll, setIsExportingPayroll] = useState(false);

  const handleDownloadPayrollExcel = async () => {
    setIsExportingPayroll(true);
    try {
      // Direct navigation forces the browser's native download manager
      // which strictly honors the server's filename and extension.
      window.location.href = '/api/reports/payroll';
      
      // Artificial delay just to show the spinner briefly
      await new Promise(resolve => setTimeout(resolve, 800));
    } catch (e) {
      console.error(e);
      alert("Failed to export Master Payroll Excel.");
    } finally {
      setIsExportingPayroll(false);
    }
  };

  const handleDownloadTimesheets = async () => {
    setIsExportingTimesheets(true);
    try {
      const csvStr = await generateTimesheetReport(startDate, endDate);
      const url = "data:text/csv;charset=utf-8," + encodeURIComponent(csvStr);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `timesheets_${startDate}_to_${endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error(e);
      alert("Failed to export report.");
    } finally {
      setIsExportingTimesheets(false);
    }
  };

  const handleDownloadLeaves = async () => {
    setIsExportingLeaves(true);
    try {
      const csvStr = await generateLeaveReport(startDate, endDate);
      const url = "data:text/csv;charset=utf-8," + encodeURIComponent(csvStr);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `pffd_requests_${startDate}_to_${endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error(e);
      alert("Failed to export report.");
    } finally {
      setIsExportingLeaves(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-8 px-4">
      <div className="rounded-2xl border bg-[#11131A] text-card-foreground shadow-sm overflow-hidden border-slate-800">
        <div className="p-6 border-b border-slate-800 bg-card/50 flex flex-col md:flex-row md:items-end gap-6">
          <div className="flex-1 space-y-4">
             <h2 className="font-semibold text-xl text-white flex items-center gap-2">
                 <CalendarIcon className="size-5 text-primary" />
                 Report Date Range
             </h2>
             
             <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label htmlFor="startDate" className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Start Date</label>
                  <input 
                    type="date" 
                    id="startDate"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-[#1A1D27] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div className="text-slate-500 pt-5">to</div>
                <div className="flex-1">
                  <label htmlFor="endDate" className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">End Date</label>
                  <input 
                    type="date" 
                    id="endDate"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-[#1A1D27] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
             </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
           <div className="grid md:grid-cols-2 gap-4">
              
              {/* Master Payroll Excel Export Card */}
              <div className="p-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors cursor-pointer group flex items-start gap-4 md:col-span-2">
                  <div className="bg-emerald-500/20 text-emerald-400 p-3 rounded-lg group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                     <FileSpreadsheet className="size-6" />
                  </div>
                  <div className="flex-1">
                     <h3 className="font-bold text-white mb-1">Master Payroll Export (Consolidated CSV)</h3>
                     <p className="text-sm text-slate-300 mb-4">
                        Download the comprehensive enterprise payroll spreadsheet exactly matching the V2 specifications. Contains Attendance Summary and Detailed Daily Logs.
                     </p>
                     
                     <button
                        onClick={handleDownloadPayrollExcel}
                        disabled={isExportingPayroll}
                        className="flex items-center gap-2 text-sm font-semibold bg-emerald-600 text-white px-4 py-2.5 rounded-lg hover:bg-emerald-500 transition-colors w-full justify-center disabled:opacity-50"
                     >
                        {isExportingPayroll ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                        {isExportingPayroll ? 'Generating Workbook...' : 'Download Master Payroll .CSV'}
                     </button>
                  </div>
              </div>

              {/* Timesheets Export Card */}
              <div className="p-5 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer group flex items-start gap-4">
                  <div className="bg-primary/20 text-primary p-3 rounded-lg group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                     <FileSpreadsheet className="size-6" />
                  </div>
                  <div className="flex-1">
                     <h3 className="font-bold text-white mb-1">Timesheet Logs</h3>
                     <p className="text-xs text-slate-400 mb-4 line-clamp-2">
                        Export raw clock-in/out records, status, and annotations for proper payroll alignment.
                     </p>
                     
                     <button
                        onClick={handleDownloadTimesheets}
                        disabled={isExportingTimesheets}
                        className="flex items-center gap-2 text-sm font-semibold bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors w-full justify-center disabled:opacity-50"
                     >
                        {isExportingTimesheets ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                        {isExportingTimesheets ? 'Preparing...' : 'Export Timesheets CSV'}
                     </button>
                  </div>
              </div>

              {/* PFFD Export Card */}
              <div className="p-5 rounded-xl border border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 transition-colors cursor-pointer group flex items-start gap-4">
                  <div className="bg-indigo-500/20 text-indigo-400 p-3 rounded-lg group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                     <FileSpreadsheet className="size-6" />
                  </div>
                  <div className="flex-1">
                     <h3 className="font-bold text-white mb-1">PFFD Requests</h3>
                     <p className="text-xs text-slate-400 mb-4 line-clamp-2">
                        Export all Pre-Funded Flex Days and leaves tracking statuses and type balances.
                     </p>
                     
                     <button
                        onClick={handleDownloadLeaves}
                        disabled={isExportingLeaves}
                        className="flex items-center gap-2 text-sm font-semibold bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-500 transition-colors w-full justify-center disabled:opacity-50"
                     >
                        {isExportingLeaves ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                        {isExportingLeaves ? 'Preparing...' : 'Export PFFD Data CSV'}
                     </button>
                  </div>
              </div>

           </div>
        </div>
      </div>
    </div>
  );
}
