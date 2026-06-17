import React from 'react';
import { Database, Clock, Eye, Check, X } from 'lucide-react';

interface PendingTableApproval {
  tableName: string;
  tableSchema: string;
  createdUserId: string;
  createdTimestamp: string;
  tableRole: string;
}

interface TableApprovalProps {
  pendingTables: PendingTableApproval[];
  loadingTables: boolean;
  handleViewSemantic: (tName: string) => void;
  handleApproveTable: (tName: string) => void;
  handleRejectTable: (tName: string) => void;
  isDark: boolean;
}

const TableApproval: React.FC<TableApprovalProps> = ({
  pendingTables,
  loadingTables,
  handleViewSemantic,
  handleApproveTable,
  handleRejectTable,
  isDark
}) => {
  return (
    <div className={`w-full p-6 rounded-3xl shadow-2xl border glass space-y-4`}>
      <div className="flex items-center justify-between pb-3 border-b border-gray-200/50 dark:border-white/10">
        <h2 className="text-base font-extrabold flex items-center gap-2">
          <Database className="w-5 h-5 text-axis-red" /> Pending Table Creations
        </h2>
        <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full ${pendingTables.length > 0
          ? (isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-800')
          : (isDark ? 'bg-white/10 text-white/50' : 'bg-gray-100 text-gray-500')
          }`}>
          {pendingTables.length} pending
        </span>
      </div>

      {loadingTables ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-2">
          <div className="w-8 h-8 border-4 border-axis-red/20 border-t-axis-red rounded-full animate-spin" />
          <span className="text-xs opacity-60 font-bold">Fetching pending table creations...</span>
        </div>
      ) : pendingTables.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <div className={`mx-auto p-3.5 rounded-full w-fit ${isDark ? 'bg-white/5 text-white/30' : 'bg-gray-55 text-gray-400'}`}>
            <Clock className="w-6 h-6" />
          </div>
          <div className="text-sm font-bold opacity-60">No Pending Table Approvals</div>
          <p className="text-[10px] opacity-40 max-w-xs mx-auto">
            All user-created tables have been processed. No table creation request is pending review.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border dark:border-white/10">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className={`border-b dark:border-white/10 font-bold uppercase tracking-wider ${isDark ? 'bg-white/5 text-white/60' : 'bg-gray-50 text-gray-500'}`}>
                <th className="px-5 py-3.5">Table Name</th>
                <th className="px-5 py-3.5">Schema Category</th>
                <th className="px-5 py-3.5">Created By</th>
                <th className="px-5 py-3.5">Timestamp (IST)</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-white/10">
              {pendingTables.map((approval) => (
                <tr key={approval.tableName} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                  <td className="px-5 py-4 font-bold">{approval.tableName}</td>
                  <td className="px-5 py-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase ${isDark ? 'bg-white/10 text-axis-cream' : 'bg-axis-burgundy/5 text-axis-burgundy'}`}>
                      {approval.tableSchema}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-mono opacity-80">{approval.createdUserId}</td>
                  <td className="px-5 py-4 opacity-60">{approval.createdTimestamp}</td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleViewSemantic(approval.tableName)}
                        className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors flex items-center gap-1 font-bold text-[10px] uppercase border dark:border-white/10 shadow-sm"
                      >
                        <Eye className="w-3.5 h-3.5" /> View
                      </button>
                      <button
                        onClick={() => handleApproveTable(approval.tableName)}
                        className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 transition-colors flex items-center gap-1 font-bold text-[10px] uppercase border border-emerald-500/25"
                      >
                        <Check className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => handleRejectTable(approval.tableName)}
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors flex items-center gap-1 font-bold text-[10px] uppercase border border-red-500/25"
                      >
                        <X className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TableApproval;
