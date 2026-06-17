import React from 'react';
import { UserCheck, Clock, Check, X } from 'lucide-react';

interface PendingUserApproval {
  userId: string;
  role: string;
}

interface UserApprovalProps {
  pendingUsers: PendingUserApproval[];
  loadingUsers: boolean;
  handleApproveUser: (uId: string) => void;
  handleRejectUser: (uId: string) => void;
  isDark: boolean;
}

const UserApproval: React.FC<UserApprovalProps> = ({
  pendingUsers,
  loadingUsers,
  handleApproveUser,
  handleRejectUser,
  isDark
}) => {
  return (
    <div className={`w-full p-6 rounded-3xl shadow-2xl border glass space-y-4`}>
      <div className="flex items-center justify-between pb-3 border-b border-gray-200/50 dark:border-white/10">
        <h2 className="text-base font-extrabold flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-axis-red" /> Pending User Registrations
        </h2>
        <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full ${pendingUsers.length > 0
          ? (isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-800')
          : (isDark ? 'bg-white/10 text-white/50' : 'bg-gray-100 text-gray-500')
          }`}>
          {pendingUsers.length} pending
        </span>
      </div>

      {loadingUsers ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-2">
          <div className="w-8 h-8 border-4 border-axis-red/20 border-t-axis-red rounded-full animate-spin" />
          <span className="text-xs opacity-60 font-bold">Fetching pending user registrations...</span>
        </div>
      ) : pendingUsers.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <div className={`mx-auto p-3.5 rounded-full w-fit ${isDark ? 'bg-white/5 text-white/30' : 'bg-gray-55 text-gray-400'}`}>
            <Clock className="w-6 h-6" />
          </div>
          <div className="text-sm font-bold opacity-60">No Pending User Approvals</div>
          <p className="text-[10px] opacity-40 max-w-xs mx-auto">
            All registration requests have been cleared. No new sign-ups are awaiting approval.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border dark:border-white/10">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className={`border-b dark:border-white/10 font-bold uppercase tracking-wider ${isDark ? 'bg-white/5 text-white/60' : 'bg-gray-50 text-gray-500'}`}>
                <th className="px-5 py-3.5">User ID</th>
                <th className="px-5 py-3.5">Assigned Role</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-white/10">
              {pendingUsers.map((pUser) => (
                <tr key={pUser.userId} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                  <td className="px-5 py-4 font-mono font-bold opacity-80">{pUser.userId}</td>
                  <td className="px-5 py-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase ${isDark ? 'bg-white/10 text-axis-cream' : 'bg-axis-burgundy/5 text-axis-burgundy'}`}>
                      {pUser.role}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleApproveUser(pUser.userId)}
                        className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 transition-colors flex items-center gap-1 font-bold text-[10px] uppercase border border-emerald-500/25"
                      >
                        <Check className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => handleRejectUser(pUser.userId)}
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

export default UserApproval;
