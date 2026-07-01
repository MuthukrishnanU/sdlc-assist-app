import React from 'react';
import { Database, UserCheck, ArrowLeft, LogOut, /*Eye, Check, Clock,*/ X, Shield, Sun, Moon, GitPullRequest, Code, Table, BarChart3 } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import axios from 'axios';

// Import modular subviews
import UserApproval from './UserApproval';
import TableApproval from './TableApproval';
import GitHubApproval from './GitHubApproval';

interface AdminDashboardProps {
  user: { userId: string; role: string };
  onLogout: () => void;
  apiBaseUrl: string;
  onNavigateToPii: () => void;
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
  test_cases?: any[];
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout, apiBaseUrl, onNavigateToPii }) => {
  const { isDark, toggleTheme } = useTheme();

  // Active view: 'menu' | 'tables' | 'users' | 'pushes' | 'dq'
  const [activeView, setActiveView] = React.useState<'menu' | 'tables' | 'users' | 'pushes' | 'dq'>('menu');

  // DQ Parameters Management State
  interface DqParameter {
    id: string;
    name: string;
    key: string;
    description: string;
    category: string;
    status: string;
  }
  const [dqParams, setDqParams] = React.useState<DqParameter[]>([]);
  const [loadingDq, setLoadingDq] = React.useState(false);
  const [editingParam, setEditingParam] = React.useState<DqParameter | null>(null);
  
  // Form fields
  const [paramName, setParamName] = React.useState('');
  const [paramKey, setParamKey] = React.useState('');
  const [paramDesc, setParamDesc] = React.useState('');
  const [paramCategory, setParamCategory] = React.useState('');
  const [paramStatus, setParamStatus] = React.useState('Active');
  const [isParamFormOpen, setIsParamFormOpen] = React.useState(false);

  const fetchDqParams = React.useCallback(async () => {
    setLoadingDq(true);
    try {
      const response = await axios.get(`${apiBaseUrl}/dq-insights/parameters`);
      setDqParams(response.data);
    } catch (err) {
      console.error('Failed to fetch DQ parameters:', err);
    } finally {
      setLoadingDq(false);
    }
  }, [apiBaseUrl]);

  React.useEffect(() => {
    if (activeView === 'dq') {
      fetchDqParams();
    }
  }, [activeView, fetchDqParams]);

  const handleSaveParam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paramName || !paramKey || !paramDesc || !paramCategory) {
      alert('Please fill out all fields.');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('name', paramName);
      formData.append('key', paramKey);
      formData.append('description', paramDesc);
      formData.append('category', paramCategory);
      formData.append('status', paramStatus);

      if (editingParam) {
        await axios.put(`${apiBaseUrl}/dq-insights/parameters/${editingParam.id}`, formData);
        alert('Parameter updated successfully.');
      } else {
        await axios.post(`${apiBaseUrl}/dq-insights/parameters`, formData);
        alert('Parameter created successfully.');
      }
      
      setParamName('');
      setParamKey('');
      setParamDesc('');
      setParamCategory('');
      setParamStatus('Active');
      setEditingParam(null);
      setIsParamFormOpen(false);
      fetchDqParams();
    } catch (err) {
      console.error('Failed to save parameter:', err);
      alert('Failed to save parameter.');
    }
  };

  const handleEditParamClick = (param: DqParameter) => {
    setEditingParam(param);
    setParamName(param.name);
    setParamKey(param.key);
    setParamDesc(param.description);
    setParamCategory(param.category);
    setParamStatus(param.status);
    setIsParamFormOpen(true);
  };

  const handleDeleteParam = async (paramId: string) => {
    if (!confirm('Are you sure you want to delete this parameter?')) return;
    try {
      await axios.delete(`${apiBaseUrl}/dq-insights/parameters/${paramId}`);
      alert('Parameter deleted successfully.');
      fetchDqParams();
    } catch (err) {
      console.error('Failed to delete parameter:', err);
      alert('Failed to delete parameter.');
    }
  };

  // Pending lists
  const [pendingTables, setPendingTables] = React.useState<PendingTableApproval[]>([]);
  const [loadingTables, setLoadingTables] = React.useState(false);
  const [pendingUsers, setPendingUsers] = React.useState<PendingUserApproval[]>([]);
  const [loadingUsers, setLoadingUsers] = React.useState(false);
  const [pendingPushes, setPendingPushes] = React.useState<PendingPushApproval[]>([]);
  const [loadingPushes, setLoadingPushes] = React.useState(false);

  // View modals for push requests
  const [viewingCodeRequest, setViewingCodeRequest] = React.useState<PendingPushApproval | null>(null);
  const [viewingTableRequest, setViewingTableRequest] = React.useState<PendingPushApproval | null>(null);
  const [viewingDqInsights, setViewingDqInsights] = React.useState<PendingPushApproval | null>(null);
  const [viewingTestCases, setViewingTestCases] = React.useState<PendingPushApproval | null>(null);

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

  // Fetch pending github pushes
  const fetchPendingPushes = React.useCallback(async () => {
    setLoadingPushes(true);
    try {
      const response = await axios.get(`${apiBaseUrl}/pending-github-pushes`);
      setPendingPushes(response.data);
    } catch (err) {
      console.error('Failed to fetch pending github pushes:', err);
    } finally {
      setLoadingPushes(false);
    }
  }, [apiBaseUrl]);

  React.useEffect(() => {
    if (activeView === 'tables') {
      fetchPendingTables();
    } else if (activeView === 'users') {
      fetchPendingUsers();
    } else if (activeView === 'pushes') {
      fetchPendingPushes();
    }
  }, [activeView, fetchPendingTables, fetchPendingUsers, fetchPendingPushes]);

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

  // Approve GitHub Push
  const handleApprovePush = async (pushId: string) => {
    if (!window.confirm(`Are you sure you want to approve this GitHub push request?`)) return;
    try {
      const response = await axios.post(`${apiBaseUrl}/approve-github-push/${pushId}`);
      if (response.data.status === 'success') {
        alert(response.data.message);
        setPendingPushes(prev => prev.filter(p => p._id !== pushId));
        if (response.data.data_html_url) {
          window.open(response.data.data_html_url, '_blank');
        }
        if (response.data.code_html_url) {
          window.open(response.data.code_html_url, '_blank');
        }
      }
    } catch (err: any) {
      console.error('GitHub push approval failed:', err);
      alert(err.response?.data?.detail || 'Failed to approve GitHub push.');
    }
  };

  // Reject GitHub Push
  const handleRejectPush = async (pushId: string) => {
    if (!window.confirm(`Are you sure you want to reject this GitHub push request?`)) return;
    try {
      const response = await axios.post(`${apiBaseUrl}/reject-github-push/${pushId}`);
      if (response.data.status === 'success') {
        alert(response.data.message);
        setPendingPushes(prev => prev.filter(p => p._id !== pushId));
      }
    } catch (err: any) {
      console.error('GitHub push rejection failed:', err);
      alert(err.response?.data?.detail || 'Failed to reject GitHub push.');
    }
  };

  return (
    <div className={`flex flex-col min-h-screen w-screen transition-colors duration-400 p-6 ${isDark ? 'bg-axis-burgundy-deep text-white' : 'bg-axis-gray text-gray-800'}`}>

      {/* Background decoration elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-axis-red/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-axis-burgundy/5 blur-[120px] pointer-events-none" />

      <div className={`w-full mx-auto space-y-6 relative z-10 flex-grow flex flex-col ${activeView !== 'pushes' ? 'max-w-5xl' : ''}`}>

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
                  : 'border-gray-200 bg-white hover:bg-gray-55 text-gray-700 shadow-sm'
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 w-full max-w-6xl">

              {/* Approve Table Creation Button Card */}
              <button
                onClick={() => setActiveView('tables')}
                className={`flex flex-col items-center justify-center text-center p-6 rounded-3xl border transition-all duration-300 hover:scale-[1.03] group shadow-xl ${isDark
                  ? 'bg-axis-burgundy-dark/40 hover:bg-axis-burgundy-dark/60 border-white/10 hover:border-axis-red/30'
                  : 'bg-white hover:bg-gray-55 border-gray-200 hover:border-axis-burgundy/20'
                  }`}
              >
                <div className={`p-4.5 rounded-2xl mb-4 transition-transform group-hover:scale-110 ${isDark ? 'bg-white/5 text-axis-cream' : 'bg-axis-burgundy/5 text-axis-burgundy'}`}>
                  <Database className="w-10 h-10 text-axis-red" />
                </div>
                <h3 className="text-base font-bold">Approve Table Creation</h3>
                <p className="text-[11px] opacity-60 mt-2 max-w-xs leading-relaxed">
                  Review schema details, generated mock records, and authorize pending database creations requested by roles.
                </p>
              </button>

              {/* Approve User Registration Button Card */}
              <button
                onClick={() => setActiveView('users')}
                className={`flex flex-col items-center justify-center text-center p-6 rounded-3xl border transition-all duration-300 hover:scale-[1.03] group shadow-xl ${isDark
                  ? 'bg-axis-burgundy-dark/40 hover:bg-axis-burgundy-dark/60 border-white/10 hover:border-axis-red/30'
                  : 'bg-white hover:bg-gray-55 border-gray-200 hover:border-axis-burgundy/20'
                  }`}
              >
                <div className={`p-4.5 rounded-2xl mb-4 transition-transform group-hover:scale-110 ${isDark ? 'bg-white/5 text-axis-cream' : 'bg-axis-burgundy/5 text-axis-burgundy'}`}>
                  <UserCheck className="w-10 h-10 text-axis-red" />
                </div>
                <h3 className="text-base font-bold">Approve User Registration</h3>
                <p className="text-[11px] opacity-60 mt-2 max-w-xs leading-relaxed">
                  Review new registration applications, assign designated domains, and authenticate new access credentials.
                </p>
              </button>

              {/* Approve Github Push Button Card */}
              <button
                onClick={() => setActiveView('pushes')}
                className={`flex flex-col items-center justify-center text-center p-6 rounded-3xl border transition-all duration-300 hover:scale-[1.03] group shadow-xl ${isDark
                  ? 'bg-axis-burgundy-dark/40 hover:bg-axis-burgundy-dark/60 border-white/10 hover:border-axis-red/30'
                  : 'bg-white hover:bg-gray-55 border-gray-200 hover:border-axis-burgundy/20'
                  }`}
              >
                <div className={`p-4.5 rounded-2xl mb-4 transition-transform group-hover:scale-110 ${isDark ? 'bg-white/5 text-axis-cream' : 'bg-axis-burgundy/5 text-axis-burgundy'}`}>
                  <GitPullRequest className="w-10 h-10 text-axis-red" />
                </div>
                <h3 className="text-base font-bold">Approve GitHub Push</h3>
                <p className="text-[11px] opacity-60 mt-2 max-w-xs leading-relaxed">
                  Review generated queries, simulated database records, and authorize code integrations to the GitHub repository.
                </p>
              </button>

              {/* Configure PII Parameter Button Card */}
              <button
                onClick={onNavigateToPii}
                className={`flex flex-col items-center justify-center text-center p-6 rounded-3xl border transition-all duration-300 hover:scale-[1.03] group shadow-xl ${isDark
                  ? 'bg-axis-burgundy-dark/40 hover:bg-axis-burgundy-dark/60 border-white/10 hover:border-axis-red/30'
                  : 'bg-white hover:bg-gray-55 border-gray-200 hover:border-axis-burgundy/20'
                  }`}
              >
                <div className={`p-4.5 rounded-2xl mb-4 transition-transform group-hover:scale-110 ${isDark ? 'bg-white/5 text-axis-cream' : 'bg-axis-burgundy/5 text-axis-burgundy'}`}>
                  <Shield className="w-10 h-10 text-axis-red" />
                </div>
                <h3 className="text-base font-bold">Add New PII Parameter</h3>
                <p className="text-[11px] opacity-60 mt-2 max-w-xs leading-relaxed">
                  Configure forbidden sensitive parameters and update custom guardrail rules to block PII access.
                </p>
              </button>

              {/* DQ Insights Configuration Card */}
              <button
                onClick={() => setActiveView('dq')}
                className={`flex flex-col items-center justify-center text-center p-6 rounded-3xl border transition-all duration-300 hover:scale-[1.03] group shadow-xl ${isDark
                  ? 'bg-axis-burgundy-dark/40 hover:bg-axis-burgundy-dark/60 border-white/10 hover:border-axis-red/30'
                  : 'bg-white hover:bg-gray-55 border-gray-200 hover:border-axis-burgundy/20'
                  }`}
              >
                <div className={`p-4.5 rounded-2xl mb-4 transition-transform group-hover:scale-110 ${isDark ? 'bg-white/5 text-axis-cream' : 'bg-axis-burgundy/5 text-axis-burgundy'}`}>
                  <BarChart3 className="w-10 h-10 text-axis-red" />
                </div>
                <h3 className="text-base font-bold">DQ Insights</h3>
                <p className="text-[11px] opacity-60 mt-2 max-w-xs leading-relaxed">
                  Configure and manage data quality insights metrics, parameters, and categories for profile inspections.
                </p>
              </button>

            </div>
          )}

          {activeView === 'tables' && (
            <TableApproval
              pendingTables={pendingTables}
              loadingTables={loadingTables}
              handleViewSemantic={handleViewSemantic}
              handleApproveTable={handleApproveTable}
              handleRejectTable={handleRejectTable}
              isDark={isDark}
            />
          )}

          {activeView === 'users' && (
            <UserApproval
              pendingUsers={pendingUsers}
              loadingUsers={loadingUsers}
              handleApproveUser={handleApproveUser}
              handleRejectUser={handleRejectUser}
              isDark={isDark}
            />
          )}

          {activeView === 'pushes' && (
            <GitHubApproval
              pendingPushes={pendingPushes}
              loadingPushes={loadingPushes}
              setViewingCodeRequest={setViewingCodeRequest}
              setViewingTableRequest={setViewingTableRequest}
              setViewingDqInsights={setViewingDqInsights}
              setViewingTestCases={setViewingTestCases}
              handleApprovePush={handleApprovePush}
              handleRejectPush={handleRejectPush}
              isDark={isDark}
            />
          )}
        </div>
      </div>

      {/* Semantic Layer Modal Popup */}
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
                      <tr className={`border-b dark:border-white/10 font-bold uppercase tracking-wider ${isDark ? 'bg-white/5 text-white/60' : 'bg-gray-55 text-gray-500'}`}>
                        <th rowSpan={2} className="px-4 py-2.5 align-middle border dark:border-white/10">Field Name</th>
                        <th rowSpan={2} className="px-4 py-2.5 align-middle border dark:border-white/10">Business Name</th>
                        <th rowSpan={2} className="px-4 py-2.5 align-middle border dark:border-white/10">Data Type</th>
                        <th rowSpan={2} className="px-4 py-2.5 align-middle border dark:border-white/10">Description</th>
                        <th rowSpan={2} className="px-4 py-2.5 align-middle border dark:border-white/10">Role</th>
                        <th rowSpan={2} className="px-4 py-2.5 align-middle border dark:border-white/10">Classification</th>
                        <th colSpan={3} className="px-4 py-2 text-center border-b dark:border-white/10">Lineage</th>
                      </tr>
                      <tr className={`border-b dark:border-white/10 font-bold uppercase tracking-wider ${isDark ? 'bg-white/5 text-white/60' : 'bg-gray-55 text-gray-500'}`}>
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

      {/* Code Output Modal Popup */}
      {viewingCodeRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-3xl rounded-3xl p-6 shadow-2xl relative border ${isDark ? 'bg-axis-burgundy-dark text-white border-white/10' : 'bg-white text-gray-800 border-gray-200'}`}>
            <button
              type="button"
              onClick={() => setViewingCodeRequest(null)}
              className={`absolute top-4 right-4 p-1.5 rounded-lg hover:bg-black/10 transition-colors ${isDark ? 'text-white/60 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className={`text-lg font-bold flex items-center gap-2 mb-1 ${isDark ? 'text-axis-cream' : 'text-axis-burgundy'}`}>
              <Code className="w-5 h-5 text-axis-red" /> Generated Code Output
            </h3>
            <p className="text-sm opacity-60 mb-4 tracking-wider font-semibold">
              Push request by: {viewingCodeRequest.userId} ({viewingCodeRequest.role})
            </p>

            <div className="max-h-[400px] overflow-y-auto border dark:border-white/10 rounded-xl custom-scrollbar">
              <pre className={`p-4 font-mono text-xs overflow-x-auto whitespace-pre-wrap select-text ${isDark ? 'bg-black/20 text-axis-cream' : 'bg-gray-55 text-gray-800'}`}>
                <code>{viewingCodeRequest.codeOutput}</code>
              </pre>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={() => setViewingCodeRequest(null)}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-axis-red hover:brightness-110 transition-all shadow-md"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Output Table Modal Popup */}
      {viewingTableRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-5xl rounded-3xl p-6 shadow-2xl relative border ${isDark ? 'bg-axis-burgundy-dark text-white border-white/10' : 'bg-white text-gray-800 border-gray-200'} flex flex-col max-h-[85vh]`}>
            <button
              type="button"
              onClick={() => setViewingTableRequest(null)}
              className={`absolute top-4 right-4 p-1.5 rounded-lg hover:bg-black/10 transition-colors ${isDark ? 'text-white/60 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className={`text-lg font-bold flex items-center gap-2 mb-1 ${isDark ? 'text-axis-cream' : 'text-axis-burgundy'}`}>
              <Table className="w-5 h-5 text-axis-red" /> Simulated Output Table
            </h3>
            <p className="text-sm opacity-60 mb-4 tracking-wider font-semibold">
              Push request by: {viewingTableRequest.userId} ({viewingTableRequest.role})
            </p>

            <div className="flex-grow overflow-auto border dark:border-white/10 rounded-xl custom-scrollbar max-h-[50vh]">
              {(() => {
                const records = viewingTableRequest.outputTableData || [];
                if (records.length === 0) {
                  return <div className="p-8 text-center text-xs opacity-50">No data records available in this push.</div>;
                }
                const columns = Object.keys(records[0]);
                return (
                  <table className="w-full text-left border-collapse text-[11px] min-w-max">
                    <thead>
                      <tr className={`border-b dark:border-white/10 font-bold uppercase tracking-wider sticky top-0 z-10 ${isDark ? 'bg-axis-burgundy-dark text-white/60' : 'bg-gray-100 text-gray-500'}`}>
                        {columns.map((col) => (
                          <th key={col} className="px-4 py-2.5 border dark:border-white/10">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-white/10">
                      {records.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                          {columns.map((col) => (
                            <td key={col} className="px-4 py-2 border dark:border-white/10 font-mono">{row[col] !== null && row[col] !== undefined ? String(row[col]) : ""}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>

            <div className="flex justify-end pt-4 shrink-0">
              <button
                type="button"
                onClick={() => setViewingTableRequest(null)}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-axis-red hover:brightness-110 transition-all shadow-md"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DQ Insights Modal Popup */}
      {viewingDqInsights && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-4xl rounded-3xl p-6 shadow-2xl relative border ${isDark ? 'bg-axis-burgundy-dark text-white border-white/10' : 'bg-white text-gray-800 border-gray-200'} flex flex-col max-h-[85vh]`}>
            <button
              type="button"
              onClick={() => setViewingDqInsights(null)}
              className={`absolute top-4 right-4 p-1.5 rounded-lg hover:bg-black/10 transition-colors ${isDark ? 'text-white/60 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className={`text-lg font-bold flex items-center gap-2 mb-1 ${isDark ? 'text-axis-cream' : 'text-axis-burgundy'}`}>
              <BarChart3 className="w-5 h-5 text-axis-red" /> Data Quality (DQ) Insights
            </h3>
            <p className="text-sm opacity-60 mb-4 tracking-wider font-semibold">
              Push request by: {viewingDqInsights.userId} ({viewingDqInsights.role})
            </p>

            <div className="flex-grow overflow-y-auto space-y-6 custom-scrollbar pr-2 max-h-[60vh]">
              {(() => {
                const dqInsights = viewingDqInsights["DQ Insights"];
                if (!dqInsights || Object.keys(dqInsights).length === 0) {
                  return (
                    <div className="p-8 text-center text-xs opacity-50">
                      No DQ Insights data available in this push.
                    </div>
                  );
                }

                return Object.entries(dqInsights).map(([tableName, columnsData]) => {
                  const data = columnsData as Record<string, any>;
                  return (
                    <div key={tableName} className={`p-5 rounded-2xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-55 border-gray-150'} space-y-3`}>
                      <h4 className={`text-sm font-bold flex items-center gap-2 ${isDark ? 'text-axis-cream' : 'text-axis-burgundy'}`}>
                        <Table className="w-4.5 h-4.5 text-axis-red" /> {tableName}
                      </h4>
                      <div className="overflow-x-auto border dark:border-white/10 rounded-xl">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className={`border-b dark:border-white/10 font-bold uppercase tracking-wider ${isDark ? 'bg-white/5 text-white/60' : 'bg-gray-100 text-gray-500'}`}>
                              <th className="px-4 py-2.5">Column Name</th>
                              <th className="px-4 py-2.5 text-right">Row Count</th>
                              <th className="px-4 py-2.5 text-right">Null Values</th>
                              <th className="px-4 py-2.5 text-right">Empty Strings</th>
                              <th className="px-4 py-2.5 text-right">Distinct Values</th>
                              <th className="px-4 py-2.5 text-right">Duplicate Rows</th>
                              <th className="px-4 py-2.5 text-right">Minimum</th>
                              <th className="px-4 py-2.5 text-right">Maximum</th>
                              <th className="px-4 py-2.5 text-right">Average</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y dark:divide-white/10">
                            {Object.entries(data).map(([colName, metrics]: [string, any]) => (
                              <tr key={colName} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                <td className="px-4 py-2.5 font-mono font-bold text-axis-red">{colName}</td>
                                <td className="px-4 py-2.5 text-right font-mono">{metrics.row_count ?? '-'}</td>
                                <td className={`px-4 py-2.5 text-right font-mono ${metrics.null_values > 0 ? 'text-amber-500 font-bold' : ''}`}>
                                  {metrics.null_values ?? '-'}
                                </td>
                                <td className="px-4 py-2.5 text-right font-mono">{metrics.empty_strings ?? '-'}</td>
                                <td className="px-4 py-2.5 text-right font-mono">{metrics.distinct_values ?? '-'}</td>
                                <td className="px-4 py-2.5 text-right font-mono">{metrics.duplicate_rows ?? '-'}</td>
                                <td className="px-4 py-2.5 text-right font-mono">
                                  {metrics.minimum !== null && metrics.minimum !== undefined ? String(metrics.minimum) : '-'}
                                </td>
                                <td className="px-4 py-2.5 text-right font-mono">
                                  {metrics.maximum !== null && metrics.maximum !== undefined ? String(metrics.maximum) : '-'}
                                </td>
                                <td className="px-4 py-2.5 text-right font-mono">
                                  {metrics.average !== null && metrics.average !== undefined ? String(metrics.average) : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            <div className="flex justify-end pt-4 shrink-0 border-t dark:border-white/10 mt-4">
              <button
                type="button"
                onClick={() => setViewingDqInsights(null)}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-axis-red hover:brightness-110 transition-all shadow-md"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test Cases Modal Popup */}
      {viewingTestCases && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-4xl rounded-3xl p-6 shadow-2xl relative border ${isDark ? 'bg-axis-burgundy-dark text-white border-white/10' : 'bg-white text-gray-800 border-gray-200'} flex flex-col max-h-[85vh]`}>
            <button
              type="button"
              onClick={() => setViewingTestCases(null)}
              className={`absolute top-4 right-4 p-1.5 rounded-lg hover:bg-black/10 transition-colors ${isDark ? 'text-white/60 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className={`text-lg font-bold flex items-center gap-2 mb-1 ${isDark ? 'text-axis-cream' : 'text-axis-burgundy'}`}>
              <GitPullRequest className="w-5 h-5 text-axis-red" /> Generated Test Cases
            </h3>
            <p className="text-sm opacity-60 mb-4 tracking-wider font-semibold">
              Push request by: {viewingTestCases.userId} ({viewingTestCases.role})
            </p>

            <div className="flex-grow overflow-y-auto space-y-4 pr-2 max-h-[60vh] custom-scrollbar text-xs">
              {(() => {
                const cases = viewingTestCases.test_cases || [];
                if (cases.length === 0) {
                  return (
                    <div className="p-8 text-center text-xs opacity-50">
                      No test cases associated with this push.
                    </div>
                  );
                }

                return cases.map((tc: any, index: number) => (
                  <div key={index} className={`p-4 rounded-xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-55 border-gray-150'} space-y-2.5`}>
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-axis-red">
                        {tc.title || `Test Scenario ${index + 1}`}
                      </h4>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${tc.scenario_type === 'Positive'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}>
                        {tc.scenario_type}
                      </span>
                    </div>

                    <p className="opacity-75">{tc.description}</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      <div className="space-y-1">
                        <span className="font-bold text-blue-400">Mock Inputs:</span>
                        {Object.entries(tc.mock_inputs || {}).map(([tbl, rows]: any) => (
                          <div key={tbl} className="ml-2">
                            <span className="font-semibold text-emerald-500">{tbl} ({rows?.length || 0} rows):</span>
                            <pre className="p-2 rounded bg-black/20 text-[10px] overflow-x-auto max-h-24 whitespace-pre">
                              {JSON.stringify(rows, null, 2)}
                            </pre>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-1 flex flex-col">
                        <span className="font-bold text-blue-400">Expected Output:</span>
                        <div className="p-3 rounded bg-black/20 text-xs flex-grow">
                          <div><strong>Expected Row Count:</strong> {tc.expected_output?.expected_row_count}</div>
                          <div className="mt-1"><strong>Description:</strong> {tc.expected_output?.description}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>

            <div className="flex justify-end pt-4 shrink-0 border-t dark:border-white/10 mt-4">
              <button
                type="button"
                onClick={() => setViewingTestCases(null)}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-axis-red hover:brightness-110 transition-all shadow-md"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

          {/* Sub-view: DQ Insights Parameter Management */}
          {activeView === 'dq' && (
            <div className={`w-full p-6 rounded-3xl shadow-2xl border glass space-y-4`}>
              <div className="flex items-center justify-between pb-3 border-b border-gray-200/50 dark:border-white/10">
                <h2 className="text-base font-extrabold flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-axis-red" /> DQ Insights Parameter Configurator
                </h2>
                <button
                  onClick={() => {
                    setEditingParam(null);
                    setParamName('');
                    setParamKey('');
                    setParamDesc('');
                    setParamCategory('');
                    setParamStatus('Active');
                    setIsParamFormOpen(true);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:brightness-110 ${isDark
                    ? 'bg-gradient-to-r from-axis-red to-axis-burgundy'
                    : 'bg-gradient-to-r from-axis-burgundy to-axis-red'}`}
                >
                  + Add Parameter
                </button>
              </div>

              {/* Form Modal/Card */}
              {isParamFormOpen && (
                <form onSubmit={handleSaveParam} className={`p-5 rounded-2xl border space-y-4 text-xs ${isDark ? 'bg-black/20 border-white/10 text-white' : 'bg-gray-550 border-gray-200 text-gray-805'}`}>
                  <h3 className="text-sm font-bold">{editingParam ? 'Edit' : 'Add'} DQ Insights Parameter</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5 text-left">
                      <label className="text-[10px] font-bold uppercase tracking-wider opacity-60">Parameter Name</label>
                      <input
                        type="text"
                        value={paramName}
                        onChange={(e) => setParamName(e.target.value)}
                        placeholder="e.g. Row Count"
                        className={`px-3 py-2 text-xs rounded-xl focus:outline-none focus:ring-2 transition-all ${isDark ? 'bg-white/10 border border-white/10 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 text-left">
                      <label className="text-[10px] font-bold uppercase tracking-wider opacity-60">Parameter Key (snake_case)</label>
                      <input
                        type="text"
                        value={paramKey}
                        onChange={(e) => setParamKey(e.target.value)}
                        placeholder="e.g. row_count"
                        className={`px-3 py-2 text-xs rounded-xl focus:outline-none focus:ring-2 transition-all ${isDark ? 'bg-white/10 border border-white/10 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 text-left">
                      <label className="text-[10px] font-bold uppercase tracking-wider opacity-60">Category</label>
                      <input
                        type="text"
                        value={paramCategory}
                        onChange={(e) => setParamCategory(e.target.value)}
                        placeholder="e.g. Completeness, Accuracy"
                        className={`px-3 py-2 text-xs rounded-xl focus:outline-none focus:ring-2 transition-all ${isDark ? 'bg-white/10 border border-white/10 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 text-left">
                      <label className="text-[10px] font-bold uppercase tracking-wider opacity-60">Status</label>
                      <select
                        value={paramStatus}
                        onChange={(e) => setParamStatus(e.target.value)}
                        className={`px-3 py-2 text-xs rounded-xl focus:outline-none focus:ring-2 transition-all ${isDark ? 'bg-axis-burgundy-dark border border-white/10 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5 text-left sm:col-span-2">
                      <label className="text-[10px] font-bold uppercase tracking-wider opacity-60">Description</label>
                      <textarea
                        value={paramDesc}
                        onChange={(e) => setParamDesc(e.target.value)}
                        placeholder="Provide description of how this metric is calculated..."
                        className={`px-3 py-2 text-xs rounded-xl h-20 resize-none focus:outline-none focus:ring-2 transition-all ${isDark ? 'bg-white/10 border border-white/10 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsParamFormOpen(false)}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${isDark ? 'border-white/10 hover:bg-white/5 text-white' : 'border-gray-200 hover:bg-gray-55 text-gray-700'}`}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-axis-red hover:brightness-110 transition-all"
                    >
                      {editingParam ? 'Update' : 'Save'} Parameter
                    </button>
                  </div>
                </form>
              )}

              {loadingDq ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-2">
                  <div className="w-8 h-8 border-4 border-axis-red/20 border-t-axis-red rounded-full animate-spin" />
                  <span className="text-xs opacity-60 font-bold">Loading DQ parameters...</span>
                </div>
              ) : dqParams.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-sm font-bold opacity-60">No DQ Parameters Configured</div>
                </div>
              ) : (
                <div className="overflow-x-auto border dark:border-white/10 rounded-2xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className={`border-b dark:border-white/10 font-bold uppercase tracking-wider ${isDark ? 'bg-black/20 text-white/50 border-white/10' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                        <th className="px-5 py-3 font-semibold">Parameter Name</th>
                        <th className="px-5 py-3 font-semibold">Key (snake_case)</th>
                        <th className="px-5 py-3 font-semibold">Category</th>
                        <th className="px-5 py-3 font-semibold">Description</th>
                        <th className="px-5 py-3 font-semibold">Status</th>
                        <th className="px-5 py-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? 'divide-white/10 text-gray-200' : 'divide-gray-100 text-gray-700'}`}>
                      {dqParams.map((param) => (
                        <tr key={param.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-200">
                          <td className="px-5 py-4 font-bold">{param.name}</td>
                          <td className="px-5 py-4 font-mono text-[10px]">{param.key}</td>
                          <td className="px-5 py-4 font-semibold">{param.category}</td>
                          <td className="px-5 py-4 max-w-xs truncate" title={param.description}>{param.description}</td>
                          <td className="px-5 py-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${param.status === 'Active'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-red-500/15 text-red-400'}`}>
                              {param.status}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleEditParamClick(param)}
                                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-colors flex items-center gap-1 ${isDark
                                  ? 'border-white/10 hover:bg-white/10 text-white'
                                  : 'border-gray-200 hover:bg-gray-100 text-gray-700 shadow-sm'}`}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteParam(param.id)}
                                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-colors flex items-center gap-1 ${isDark
                                  ? 'border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-400'
                                  : 'border-red-150 bg-red-50 hover:bg-red-100 text-red-700 shadow-sm'}`}
                              >
                                Delete
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
  );
};

export default AdminDashboard;
