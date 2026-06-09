import React from 'react';
import { Database, UserCheck, ArrowLeft, LogOut, Eye, Check, X, Shield, Clock, Sun, Moon } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import axios from 'axios';

interface AdminDashboardProps {
  user: { userId: string; role: string };
  onLogout: () => void;
  apiBaseUrl: string;
}

interface PendingTableApproval {
  tableName: string;
  tableSchema: string;
  createdUserId: string;
  createdTimestamp: string;
  tableRole: string;
}

interface PendingUserApproval {
  userId: string;
  role: string;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout, apiBaseUrl }) => {
  const { isDark, toggleTheme } = useTheme();

  // Active view: 'menu' | 'tables' | 'users'
  const [activeView, setActiveView] = React.useState<'menu' | 'tables' | 'users'>('menu');

  // Pending lists
  const [pendingTables, setPendingTables] = React.useState<PendingTableApproval[]>([]);
  const [loadingTables, setLoadingTables] = React.useState(false);
  const [pendingUsers, setPendingUsers] = React.useState<PendingUserApproval[]>([]);
  const [loadingUsers, setLoadingUsers] = React.useState(false);

  // Semantic layer modal
  const [semanticModalOpen, setSemanticModalOpen] = React.useState(false);
  const [viewingTable, setViewingTable] = React.useState<string | null>(null);
  const [semanticData, setSemanticData] = React.useState<any>(null);
  const [loadingSemantic, setLoadingSemantic] = React.useState(false);

  // Fetch pending table approvals
  const fetchPendingTables = React.useCallback(async () => {
    setLoadingTables(true);
    try {
      const response = await axios.get(`${apiBaseUrl}/pending-approvals`);
      setPendingTables(response.data);
    } catch (err) {
      console.error('Failed to fetch pending table approvals:', err);
    } finally {
      setLoadingTables(false);
    }
  }, [apiBaseUrl]);

  // Fetch pending user approvals
  const fetchPendingUsers = React.useCallback(async () => {
    setLoadingUsers(true);
    try {
      const response = await axios.get(`${apiBaseUrl}/pending-user-registrations`);
      setPendingUsers(response.data);
    } catch (err) {
      console.error('Failed to fetch pending user registrations:', err);
    } finally {
      setLoadingUsers(false);
    }
  }, [apiBaseUrl]);

  React.useEffect(() => {
    if (activeView === 'tables') {
      fetchPendingTables();
    } else if (activeView === 'users') {
      fetchPendingUsers();
    }
  }, [activeView, fetchPendingTables, fetchPendingUsers]);

  // Approve Table
  const handleApproveTable = async (tName: string) => {
    if (!window.confirm(`Are you sure you want to approve the table "${tName}"?`)) return;
    try {
      const response = await axios.post(`${apiBaseUrl}/approve-table/${tName}`);
      if (response.data.status === 'success') {
        alert(response.data.message);
        setPendingTables(prev => prev.filter(t => t.tableName !== tName));
      }
    } catch (err: any) {
      console.error('Table approval failed:', err);
      alert(err.response?.data?.detail || 'Failed to approve table.');
    }
  };

  // Reject Table
  const handleRejectTable = async (tName: string) => {
    if (!window.confirm(`Are you sure you want to reject the table "${tName}"?`)) return;
    try {
      const response = await axios.post(`${apiBaseUrl}/reject-table/${tName}`);
      if (response.data.status === 'success') {
        alert(response.data.message);
        setPendingTables(prev => prev.filter(t => t.tableName !== tName));
      }
    } catch (err: any) {
      console.error('Table rejection failed:', err);
      alert(err.response?.data?.detail || 'Failed to reject table.');
    }
  };

  // View Semantic Layer
  const handleViewSemantic = async (tName: string) => {
    setViewingTable(tName);
    setSemanticModalOpen(true);
    setLoadingSemantic(true);
    setSemanticData(null);
    try {
      const response = await axios.get(`${apiBaseUrl}/semantic-layer/${tName}`);
      setSemanticData(response.data);
    } catch (err: any) {
      console.error('Failed to load semantic layer:', err);
      alert(err.response?.data?.detail || 'Failed to load semantic layer metadata.');
      setSemanticModalOpen(false);
    } finally {
      setLoadingSemantic(false);
    }
  };

  // Approve User Registration
  const handleApproveUser = async (uId: string) => {
    if (!window.confirm(`Are you sure you want to approve user registration for "${uId}"?`)) return;
    try {
      const response = await axios.post(`${apiBaseUrl}/approve-user/${uId}`);
      if (response.data.status === 'success') {
        alert(response.data.message);
        setPendingUsers(prev => prev.filter(u => u.userId !== uId));
      }
    } catch (err: any) {
      console.error('User approval failed:', err);
      alert(err.response?.data?.detail || 'Failed to approve user.');
    }
  };

  // Reject User Registration
  const handleRejectUser = async (uId: string) => {
    if (!window.confirm(`Are you sure you want to reject user registration for "${uId}"?`)) return;
    try {
      const response = await axios.post(`${apiBaseUrl}/reject-user/${uId}`);
      if (response.data.status === 'success') {
        alert(response.data.message);
        setPendingUsers(prev => prev.filter(u => u.userId !== uId));
      }
    } catch (err: any) {
      console.error('User rejection failed:', err);
      alert(err.response?.data?.detail || 'Failed to reject user.');
    }
  };

  return (
    <div className={`flex flex-col min-h-screen w-screen transition-colors duration-400 p-6 ${isDark ? 'bg-axis-burgundy-deep text-white' : 'bg-axis-gray text-gray-800'}`}>

      {/* Background decoration elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-axis-red/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-axis-burgundy/5 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-5xl mx-auto space-y-6 relative z-10 flex-grow flex flex-col">

        {/* Navigation Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-200/50 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isDark ? 'bg-white/10 text-axis-cream' : 'bg-axis-burgundy/10 text-axis-burgundy'}`}>
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className={`text-2xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r ${isDark ? 'from-axis-cream to-axis-red' : 'from-axis-burgundy to-axis-red'}`}>
                Admin Administration Panel
              </h1>
              <p className="text-xs opacity-60 mt-0.5">
                Logged in as: <span className="font-semibold text-axis-red">{user.userId}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {activeView !== 'menu' && (
              <button
                onClick={() => setActiveView('menu')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 hover:scale-[1.02] ${isDark
                  ? 'border-white/10 bg-white/5 hover:bg-white/10 text-white'
                  : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700 shadow-sm'
                  }`}
              >
                <ArrowLeft className="w-4 h-4" /> Dashboard Menu
              </button>
            )}

            <button
              onClick={onLogout}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 hover:scale-[1.02] ${isDark
                ? 'border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30'
                : 'border-red-200 bg-red-50 hover:bg-red-100 text-red-700 shadow-sm'
                }`}
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>

            <button
              onClick={toggleTheme}
              type="button"
              className={`relative w-14 h-7 rounded-full transition-all duration-400 flex items-center shrink-0 ${isDark
                ? 'bg-axis-burgundy-dark border border-axis-red/30 shadow-[0_0_12px_rgba(235,17,101,0.15)]'
                : 'bg-gray-200 border border-gray-300'
                }`}
              aria-label="Toggle dark mode"
            >
              <div
                className={`absolute w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300 ${isDark
                  ? 'translate-x-[30px] bg-axis-red shadow-lg shadow-axis-red/30'
                  : 'translate-x-1 bg-white shadow-md'
                  }`}
              >
                {isDark ? (
                  <Moon className="w-3.5 h-3.5 text-white" />
                ) : (
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                )}
              </div>
            </button>
          </div>
        </div>

        {/* Central Content Area */}
        <div className="flex-grow flex items-center justify-center py-6">
          {activeView === 'menu' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-3xl">

              {/* Approve Table Creation Button Card */}
              <button
                onClick={() => setActiveView('tables')}
                className={`flex flex-col items-center justify-center text-center p-8 rounded-3xl border transition-all duration-300 hover:scale-[1.03] group shadow-xl ${isDark
                  ? 'bg-axis-burgundy-dark/40 hover:bg-axis-burgundy-dark/60 border-white/10 hover:border-axis-red/30'
                  : 'bg-white hover:bg-gray-50 border-gray-200 hover:border-axis-burgundy/20'
                  }`}
              >
                <div className={`p-5 rounded-2xl mb-4 transition-transform group-hover:scale-110 ${isDark ? 'bg-white/5 text-axis-cream' : 'bg-axis-burgundy/5 text-axis-burgundy'}`}>
                  <Database className="w-12 h-12 text-axis-red" />
                </div>
                <h3 className="text-lg font-bold">Approve Table Creation Into Metastore</h3>
                <p className="text-xs opacity-60 mt-2 max-w-xs leading-relaxed">
                  Review schema details, generated mock records, and authorize pending database creations requested by roles.
                </p>
              </button>

              {/* Approve User Registration Button Card */}
              <button
                onClick={() => setActiveView('users')}
                className={`flex flex-col items-center justify-center text-center p-8 rounded-3xl border transition-all duration-300 hover:scale-[1.03] group shadow-xl ${isDark
                  ? 'bg-axis-burgundy-dark/40 hover:bg-axis-burgundy-dark/60 border-white/10 hover:border-axis-red/30'
                  : 'bg-white hover:bg-gray-50 border-gray-200 hover:border-axis-burgundy/20'
                  }`}
              >
                <div className={`p-5 rounded-2xl mb-4 transition-transform group-hover:scale-110 ${isDark ? 'bg-white/5 text-axis-cream' : 'bg-axis-burgundy/5 text-axis-burgundy'}`}>
                  <UserCheck className="w-12 h-12 text-axis-red" />
                </div>
                <h3 className="text-lg font-bold">Approve User Registration</h3>
                <p className="text-xs opacity-60 mt-2 max-w-xs leading-relaxed">
                  Review new registration applications, assign designated domains, and authenticate new access credentials.
                </p>
              </button>

            </div>
          )}

          {/* Sub-view: Pending Table Creations */}
          {activeView === 'tables' && (
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
                  <div className={`mx-auto p-3.5 rounded-full w-fit ${isDark ? 'bg-white/5 text-white/30' : 'bg-gray-50 text-gray-400'}`}>
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
          )}

          {/* Sub-view: Pending User Registrations */}
          {activeView === 'users' && (
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
                  <div className={`mx-auto p-3.5 rounded-full w-fit ${isDark ? 'bg-white/5 text-white/30' : 'bg-gray-50 text-gray-400'}`}>
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
          )}
        </div>
      </div>

      {/* Semantic Layer Modal Popup (Adapted from CreateTablePage) */}
      {semanticModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-4xl rounded-3xl p-6 shadow-2xl relative border ${isDark ? 'bg-axis-burgundy-dark text-white border-white/10' : 'bg-white text-gray-800 border-gray-200'}`}>
            <button
              type="button"
              onClick={() => setSemanticModalOpen(false)}
              className={`absolute top-4 right-4 p-1.5 rounded-lg hover:bg-black/10 transition-colors ${isDark ? 'text-white/60 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className={`text-lg font-bold flex items-center gap-2 mb-1 ${isDark ? 'text-axis-cream' : 'text-axis-burgundy'}`}>
              <Shield className="w-5 h-5 text-axis-red" /> Semantic Layer Metadata
            </h3>
            <p className="text-sm opacity-60 mb-4 tracking-wider font-semibold">
              Schema details for: {viewingTable}
            </p>

            {loadingSemantic ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-2">
                <div className="w-8 h-8 border-4 border-axis-red/20 border-t-axis-red rounded-full animate-spin" />
                <span className="text-xs opacity-60">Loading semantic layer...</span>
              </div>
            ) : semanticData ? (
              <div className="space-y-4">
                <div className={`p-4 rounded-xl border space-y-1.5 transition-colors duration-400 ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-55 border-gray-150'}`}>
                  <div className="text-xs flex">
                    <span className="opacity-60">Business Name:</span>
                    <span className="font-bold pl-4">{semanticData.friendly_name}</span>
                  </div>
                  <div className="text-xs flex">
                    <span className="opacity-60">Primary Key Field:</span>
                    <span className="font-mono pl-4 text-axis-red font-bold">{semanticData.primary_key}</span>
                  </div>
                  <div className="text-xs flex">
                    <span className="opacity-60">Description:</span>
                    <span className="text-right pl-4 max-w-sm font-medium">{semanticData.description}</span>
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto border dark:border-white/10 custom-scrollbar">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className={`border-b dark:border-white/10 font-bold uppercase tracking-wider ${isDark ? 'bg-white/5 text-white/60' : 'bg-gray-50 text-gray-500'}`}>
                        <th rowSpan={2} className="px-4 py-2.5 align-middle border dark:border-white/10">Field Name</th>
                        <th rowSpan={2} className="px-4 py-2.5 align-middle border dark:border-white/10">Business Name</th>
                        <th rowSpan={2} className="px-4 py-2.5 align-middle border dark:border-white/10">Data Type</th>
                        <th rowSpan={2} className="px-4 py-2.5 align-middle border dark:border-white/10">Description</th>
                        <th rowSpan={2} className="px-4 py-2.5 align-middle border dark:border-white/10">Role</th>
                        <th rowSpan={2} className="px-4 py-2.5 align-middle border dark:border-white/10">Classification</th>
                        <th colSpan={3} className="px-4 py-2 text-center border-b dark:border-white/10">Lineage</th>
                      </tr>
                      <tr className={`border-b dark:border-white/10 font-bold uppercase tracking-wider ${isDark ? 'bg-white/5 text-white/60' : 'bg-gray-50 text-gray-500'}`}>
                        <th className="px-4 py-2 text-xs border dark:border-white/10">Source Columns</th>
                        <th className="px-4 py-2 text-xs border dark:border-white/10">Source Tables</th>
                        <th className="px-4 py-2 text-xs border dark:border-white/10">Transformation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-white/10">
                      {semanticData.fields?.map((field: any) => (
                        <tr key={field.field_name} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                          <td className="px-4 py-2.5 border dark:border-white/10 font-mono font-bold text-axis-red">{field.field_name}</td>
                          <td className="px-4 py-2.5 border dark:border-white/10">{field.friendly_name}</td>
                          <td className="px-4 py-2.5 border dark:border-white/10 font-mono">{field.data_type}</td>
                          <td className="px-4 py-2.5 border dark:border-white/10 font-mono">{field.description}</td>
                          <td className="px-4 py-2.5 border dark:border-white/10">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${field.role === 'identifier'
                              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                              : field.role === 'measure'
                                ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                                : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                              }`}>
                              {field.role}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 border dark:border-white/10">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${field.classification === 'PII'
                              ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                              : 'bg-gray-500/10 text-gray-500 border border-gray-500/20'
                              }`}>
                              {field.classification}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-mono border dark:border-white/10">{field.lineage?.source_columns?.join(", ") || ""}</td>
                          <td className="px-4 py-2.5 font-mono border dark:border-white/10">{field.lineage?.source_tables?.join(", ") || ""}</td>
                          <td className="px-4 py-2.5 border dark:border-white/10">{field.lineage?.transformation || ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setSemanticModalOpen(false)}
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-axis-red hover:brightness-110 transition-all shadow-md"
                  >
                    Close View
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-xs opacity-50">
                Failed to load details.
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;
