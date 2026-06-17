import React from 'react';
import { GitPullRequest, Clock, Code, Table, BarChart3, Check, X } from 'lucide-react';

interface PendingPushApproval {
  _id: string;
  userId: string;
  role: string;
  timestamp: string;
  podName: string;
  projectName: string;
  codeOutput?: string;
  outputTableData?: any[];
  "DQ Insights"?: any;
  test_cases?: any;
}

interface GitHubApprovalProps {
  pendingPushes: PendingPushApproval[];
  loadingPushes: boolean;
  setViewingCodeRequest: (push: PendingPushApproval) => void;
  setViewingTableRequest: (push: PendingPushApproval) => void;
  setViewingDqInsights: (push: PendingPushApproval) => void;
  setViewingTestCases: (push: PendingPushApproval) => void;
  handleApprovePush: (pushId: string) => void;
  handleRejectPush: (pushId: string) => void;
  isDark: boolean;
}

const GitHubApproval: React.FC<GitHubApprovalProps> = ({
  pendingPushes,
  loadingPushes,
  setViewingCodeRequest,
  setViewingTableRequest,
  setViewingDqInsights,
  setViewingTestCases,
  handleApprovePush,
  handleRejectPush,
  isDark
}) => {
  return (
    <div className={`w-full p-6 rounded-3xl shadow-2xl border glass space-y-4`}>
      <div className="flex items-center justify-between pb-3 border-b border-gray-200/50 dark:border-white/10">
        <h2 className="text-base font-extrabold flex items-center gap-2">
          <GitPullRequest className="w-5 h-5 text-axis-red" /> Pending GitHub Pushes
        </h2>
        <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full ${pendingPushes.length > 0
          ? (isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-800')
          : (isDark ? 'bg-white/10 text-white/50' : 'bg-gray-100 text-gray-500')
          }`}>
          {pendingPushes.length} pending
        </span>
      </div>

      {loadingPushes ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-2">
          <div className="w-8 h-8 border-4 border-axis-red/20 border-t-axis-red rounded-full animate-spin" />
          <span className="text-xs opacity-60 font-bold">Fetching pending github pushes...</span>
        </div>
      ) : pendingPushes.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <div className={`mx-auto p-3.5 rounded-full w-fit ${isDark ? 'bg-white/5 text-white/30' : 'bg-gray-55 text-gray-400'}`}>
            <Clock className="w-6 h-6" />
          </div>
          <div className="text-sm font-bold opacity-60">No Pending GitHub Pushes</div>
          <p className="text-[10px] opacity-40 max-w-xs mx-auto">
            All push requests have been successfully processed or verified.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto border dark:border-white/10">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className={`border-b dark:border-white/10 font-bold uppercase tracking-wider ${isDark ? 'bg-white/5 text-white/60' : 'bg-gray-50 text-gray-500'}`}>
                <th className="px-5 py-3.5 border border-black">User ID</th>
                <th className="px-5 py-3.5 border border-black">Role</th>
                <th className="px-5 py-3.5 border border-black">Timestamp</th>
                <th className="px-5 py-3.5 border border-black">Pod Name</th>
                <th className="px-5 py-3.5 border border-black">Project Name</th>
                <th className="px-5 py-3.5 text-center border border-black">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-white/10">
              {pendingPushes.map((push) => (
                <tr key={push._id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                  <td className="px-5 py-4 border border-black font-mono font-bold opacity-80">{push.userId}</td>
                  <td className="px-5 py-4 border border-black">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase ${isDark ? 'bg-white/10 text-axis-cream' : 'bg-axis-burgundy/5 text-axis-burgundy'}`}>
                      {push.role}
                    </span>
                  </td>
                  <td className="px-5 py-4 border border-black opacity-60">{push.timestamp}</td>
                  <td className="px-5 py-4 border border-black opacity-80">{push.podName}</td>
                  <td className="px-5 py-4 border border-black opacity-80">{push.projectName}</td>
                  <td className="px-5 py-4 border border-black text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setViewingCodeRequest(push)}
                        className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors flex items-center gap-1 font-bold text-[10px] uppercase border border-black shadow-sm"
                        title="View Code Output"
                      >
                        <Code className="w-3.5 h-3.5" /> View Code
                      </button>
                      <button
                        onClick={() => setViewingTableRequest(push)}
                        className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors flex items-center gap-1 font-bold text-[10px] uppercase border border-black shadow-sm"
                        title="View Output Table"
                      >
                        <Table className="w-3.5 h-3.5" /> View Table
                      </button>
                      <button
                        onClick={() => setViewingDqInsights(push)}
                        className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors flex items-center gap-1 font-bold text-[10px] uppercase border border-black shadow-sm"
                        title="View Tablewise Column DQ Insights"
                      >
                        <BarChart3 className="w-3.5 h-3.5" /> View DQ Insights
                      </button>
                      {push.test_cases && push.test_cases.length > 0 && (
                        <button
                          onClick={() => setViewingTestCases(push)}
                          className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors flex items-center gap-1 font-bold text-[10px] uppercase border border-black shadow-sm"
                          title="View Test Cases"
                        >
                          <Table className="w-3.5 h-3.5" /> View Test Cases
                        </button>
                      )}
                      <button
                        onClick={() => handleApprovePush(push._id)}
                        className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 transition-colors flex items-center gap-1 font-bold text-[10px] uppercase border border-emerald-500/25"
                      >
                        <Check className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => handleRejectPush(push._id)}
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

export default GitHubApproval;
