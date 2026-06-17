import React from 'react';
import { ArrowLeft, Database, Upload, FileSpreadsheet, CheckCircle, AlertTriangle, Eye, Check, X, Shield, Clock, Sun, Moon } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import axios from 'axios';

interface CreateTablePageProps {
  user: { userId: string; role: string; domain?: string[] };
  onBack: () => void;
  apiBaseUrl: string;
}

interface PendingApproval {
  tableName: string;
  tableSchema: string;
  createdUserId: string;
  createdTimestamp: string;
  tableRole: string;
}

const CreateTablePage: React.FC<CreateTablePageProps> = ({ user, onBack, apiBaseUrl }) => {
  const { isDark, toggleTheme } = useTheme();

  // Form states
  const [tableName, setTableName] = React.useState('');
  const [tableSchema, setTableSchema] = React.useState('');
  const [tableDomain, setTableDomain] = React.useState('');
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);

  // UI states
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Admin pending list
  const [pendingApprovals, setPendingApprovals] = React.useState<PendingApproval[]>([]);
  const [loadingPending, setLoadingPending] = React.useState(false);

  // Semantic Layer modal states
  const [semanticModalOpen, setSemanticModalOpen] = React.useState(false);
  const [viewingTable, setViewingTable] = React.useState<string | null>(null);
  const [semanticData, setSemanticData] = React.useState<any>(null);
  const [loadingSemantic, setLoadingSemantic] = React.useState(false);

  // Fetch pending approvals for admin
  const fetchPendingApprovals = React.useCallback(async () => {
    if (user.role !== 'admin') return;
    setLoadingPending(true);
    try {
      const response = await axios.get(`${apiBaseUrl}/pending-approvals`);
      setPendingApprovals(response.data);
    } catch (err) {
      console.error('Failed to fetch pending approvals:', err);
    } finally {
      setLoadingPending(false);
    }
  }, [apiBaseUrl, user.role]);

  React.useEffect(() => {
    fetchPendingApprovals();
  }, [fetchPendingApprovals]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setStatusMessage(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableName.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter a table name.' });
      return;
    }
    if (!tableSchema.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter a schema name.' });
      return;
    }
    if (!tableDomain) {
      setStatusMessage({ type: 'error', text: 'Please select a table domain.' });
      return;
    }
    if (!selectedFile) {
      setStatusMessage({ type: 'error', text: 'Please choose an Excel file to upload.' });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    const formData = new FormData();
    formData.append('tableName', tableName.trim());
    formData.append('tableSchema', tableSchema.trim());
    formData.append('userId', user.userId);
    formData.append('role', user.role);
    formData.append('tableDomain', tableDomain);
    formData.append('file', selectedFile);

    try {
      const response = await axios.post(`${apiBaseUrl}/create-table`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.status === 'success') {
        alert(response.data.message);
        setStatusMessage({
          type: 'success',
          text: `Table "${response.data.tableName}" creation request submitted and approval email sent to admin.`,
        });
        // Clear form
        setTableName('');
        setTableSchema('');
        setTableDomain('');
        setSelectedFile(null);
        // Refresh admin list just in case
        fetchPendingApprovals();
      }
    } catch (err: any) {
      console.error('Table creation error:', err);
      const errMsg = err.response?.data?.detail || 'An error occurred during table creation.';
      setStatusMessage({ type: 'error', text: errMsg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (tName: string) => {
    if (!window.confirm(`Are you sure you want to approve the table "${tName}"?`)) return;
    try {
      const response = await axios.post(`${apiBaseUrl}/approve-table/${tName}`);
      if (response.data.status === 'success') {
        alert(`Table "${tName}" has been approved.`);
        // Remove from list
        setPendingApprovals(prev => prev.filter(t => t.tableName !== tName));
      }
    } catch (err: any) {
      console.error('Approve failed:', err);
      alert(err.response?.data?.detail || 'Failed to approve table.');
    }
  };

  const handleReject = async (tName: string) => {
    if (!window.confirm(`Are you sure you want to reject the table "${tName}"?`)) return;
    try {
      const response = await axios.post(`${apiBaseUrl}/reject-table/${tName}`);
      if (response.data.status === 'success') {
        alert(`Table "${tName}" has been rejected.`);
        // Remove from list
        setPendingApprovals(prev => prev.filter(t => t.tableName !== tName));
      }
    } catch (err: any) {
      console.error('Reject failed:', err);
      alert(err.response?.data?.detail || 'Failed to reject table.');
    }
  };

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

  const specialNote = [
    'Ensure the uploaded file has only 3 columns of data.',
    'The 1st Column must have the names of the required columns.',
    'The 2nd Column must specify the Data Type of the corresponding column.',
    'The 3rd Column must specify 3 examples (separated by comma) of the corresponding column (optional).'
  ];

  return (
    <div className={`flex flex-col min-h-screen w-screen transition-colors duration-400 p-6 ${isDark ? 'bg-axis-burgundy-deep text-white' : 'bg-axis-gray text-gray-800'}`}>

      {/* Background decoration elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-axis-red/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-axis-burgundy/5 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-4xl mx-auto space-y-6 relative z-10 flex-grow">

        {/* Navigation Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-200/50 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isDark ? 'bg-white/10 text-axis-cream' : 'bg-axis-burgundy/10 text-axis-burgundy'}`}>
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h1 className={`text-2xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r ${isDark ? 'from-axis-cream to-axis-red' : 'from-axis-burgundy to-axis-red'}`}>
                {user.role === 'admin' ? 'Approve Table Creation Requests' : 'Add New Table into Metastore'}
              </h1>
              <p className={`text-xs opacity-60 mt-0.5`}>
                {user.role === 'admin' ? 'View new Metastore entries and approve pending table creation requests' : 'Specify schema and upload fields template'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 hover:scale-[1.02] ${isDark
                ? 'border-white/10 bg-white/5 hover:bg-white/10 text-white'
                : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700 shadow-sm'
                }`}
            >
              <ArrowLeft className="w-4 h-4" /> Go Back
            </button>

            <button
              onClick={toggleTheme}
              type="button"
              className={`relative w-14 h-7 rounded-full transition-all duration-400 flex items-center shrink-0 ${isDark
                ? 'bg-axis-burgundy-dark border border-axis-red/30 shadow-[0_0_12px_rgba(235,17,101,0.15)]'
                : 'bg-gray-200 border border-gray-300'
                }`}
              aria-label="Toggle dark mode"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
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

        {/* Form and info row */}
        {user.role !== 'admin' && <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Main Form container */}
          <div className={`md:col-span-2 p-6 rounded-3xl shadow-2xl border glass space-y-5`}>
            <h2 className="text-base font-bold flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-axis-red" /> Schema Setup
            </h2>

            {statusMessage && (
              <div className={`p-4 rounded-xl flex items-start gap-3 border text-xs font-semibold animate-in fade-in slide-in-from-top-2 ${statusMessage.type === 'success'
                ? (isDark ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800')
                : (isDark ? 'bg-red-500/10 border-red-500/30 text-red-300' : 'bg-red-50 border-red-200 text-red-800')
                }`}>
                {statusMessage.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                )}
                <div>{statusMessage.text}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Table Name */}
              <div className="space-y-1.5">
                <label className={`text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${isDark ? 'text-white/50' : 'text-gray-550'}`}>
                  New Table Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. branchTransactions"
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  className={`w-full rounded-xl pl-4 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all ${isDark
                    ? 'bg-white/10 border border-white/10 text-white placeholder-white/30 focus:ring-axis-red/30'
                    : 'bg-white border border-gray-200 text-gray-700 placeholder-gray-400 focus:ring-axis-burgundy/20'
                    }`}
                />
              </div>

              {/* Table Schema */}
              <div className="space-y-1.5">
                <label className={`text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${isDark ? 'text-white/50' : 'text-gray-550'}`}>
                  Table Schema Name / Category
                </label>
                <input
                  type="text"
                  placeholder="e.g. Data Engineering, Healthcare, Media"
                  value={tableSchema}
                  onChange={(e) => setTableSchema(e.target.value)}
                  className={`w-full rounded-xl pl-4 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all ${isDark
                    ? 'bg-white/10 border border-white/10 text-white placeholder-white/30 focus:ring-axis-red/30'
                    : 'bg-white border border-gray-200 text-gray-700 placeholder-gray-400 focus:ring-axis-burgundy/20'
                    }`}
                />
              </div>

              {/* Select Table Domain */}
              <div className="space-y-1.5">
                <label className={`text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${isDark ? 'text-white/50' : 'text-gray-550'}`}>
                  Select Table Domain
                </label>
                <select
                  value={tableDomain}
                  onChange={(e) => setTableDomain(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all cursor-pointer ${isDark
                    ? 'bg-white/10 border border-white/10 text-white focus:ring-axis-red/30'
                    : 'bg-white border border-gray-200 text-gray-700 focus:ring-axis-burgundy/20'
                  }`}
                >
                  <option value="" className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>
                    Select Table Domain
                  </option>
                  {user.domain?.map((d) => (
                    <option key={d} value={d} className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {/* File Upload */}
              <div className="space-y-1.5">
                <label className={`text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${isDark ? 'text-white/50' : 'text-gray-555'}`}>
                  Schema Excel Sheet
                </label>

                <div className={`relative border-2 border-dashed rounded-2xl p-6 transition-all flex flex-col items-center justify-center cursor-pointer ${selectedFile
                  ? (isDark ? 'bg-axis-red/10 border-axis-red/50' : 'bg-axis-cream border-axis-burgundy/40')
                  : (isDark ? 'border-white/20 hover:border-white/30 bg-white/5' : 'border-gray-300 hover:border-gray-400 bg-white')
                  }`}>
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="text-center space-y-2 pointer-events-none">
                    <div className={`mx-auto p-3 rounded-full w-fit ${selectedFile
                      ? (isDark ? 'bg-axis-red/20 text-axis-red' : 'bg-axis-burgundy/10 text-axis-burgundy')
                      : (isDark ? 'bg-white/10 text-white/50' : 'bg-gray-100 text-gray-400')
                      }`}>
                      <Upload className="w-5 h-5" />
                    </div>
                    {selectedFile ? (
                      <div className="space-y-1">
                        <div className="font-bold text-xs truncate max-w-xs">{selectedFile.name}</div>
                        <div className="text-[10px] opacity-60">{(selectedFile.size / 1024).toFixed(1)} KB</div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="font-bold text-xs">Drag and drop or click to choose Excel file</div>
                        <div className="text-[10px] opacity-60">Supports .xlsx and .xls formats</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full hover:brightness-110 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group shadow-lg ${isDark
                  ? 'bg-gradient-to-r from-axis-red to-axis-burgundy shadow-black/30'
                  : 'bg-gradient-to-r from-axis-burgundy to-axis-red shadow-axis-burgundy/20'
                  }`}
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Database className="w-4 h-4" /> Create Table & Generate Data
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Guidelines Sidebar */}
          <div className="space-y-6">
            {/* Special Note Container */}
            <div className={`p-6 rounded-3xl shadow-xl border glass relative overflow-hidden transition-colors ${isDark ? 'border-axis-red/20 bg-axis-red/5' : 'border-axis-burgundy/15 bg-axis-cream/50'
              }`}>
              <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-axis-red/5 blur-xl pointer-events-none" />

              <h3 className={`text-xs font-black uppercase tracking-wider flex items-center gap-2 mb-3 ${isDark ? 'text-axis-cream' : 'text-axis-burgundy'
                }`}>
                <AlertTriangle className="w-4 h-4 text-axis-red shrink-0" /> Special Note
              </h3>
              <ul className={`text-xs leading-relaxed font-medium pl-2 ${isDark ? 'text-white/70' : 'text-gray-600'}`}>
                {specialNote.map((note, index) => (
                  <li key={index} style={{ listStyleType: 'Disc' }}>{note}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>}

        {/* Admin Approvals Section */}
        {user.role === 'admin' && (
          <div className={`p-6 rounded-3xl shadow-2xl border glass space-y-4 mt-8 animate-in fade-in duration-300`}>
            <div className="flex items-center justify-between pb-3 border-b border-gray-200/50 dark:border-white/10">
              <h2 className="text-base font-extrabold flex items-center gap-2">
                <Shield className="w-5 h-5 text-axis-red" /> Pending Approvals
              </h2>
              <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full ${pendingApprovals.length > 0
                ? (isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-800')
                : (isDark ? 'bg-white/10 text-white/50' : 'bg-gray-100 text-gray-500')
                }`}>
                {pendingApprovals.length} pending
              </span>
            </div>

            {loadingPending ? (
              <div className="flex flex-col items-center justify-center py-10 space-y-2">
                <div className="w-8 h-8 border-4 border-axis-red/20 border-t-axis-red rounded-full animate-spin" />
                <span className="text-xs opacity-60 font-bold">Fetching pending approvals...</span>
              </div>
            ) : pendingApprovals.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <div className={`mx-auto p-3.5 rounded-full w-fit ${isDark ? 'bg-white/5 text-white/30' : 'bg-gray-50 text-gray-400'}`}>
                  <Clock className="w-6 h-6" />
                </div>
                <div className="text-sm font-bold opacity-60">No Pending Approvals</div>
                <p className="text-[10px] opacity-40 max-w-xs mx-auto">
                  All dynamically created tables are currently approved and ready for use.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border dark:border-white/10">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className={`border-b dark:border-white/10 font-bold uppercase tracking-wider ${isDark ? 'bg-white/5 text-white/60' : 'bg-gray-50 text-gray-500'
                      }`}>
                      <th className="px-5 py-3">Table Name</th>
                      <th className="px-5 py-3">Schema Category</th>
                      <th className="px-5 py-3">Created By</th>
                      <th className="px-5 py-3">Timestamp (IST)</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-white/10">
                    {pendingApprovals.map((approval) => (
                      <tr key={approval.tableName} className={`hover:bg-black/5 dark:hover:bg-white/5 transition-colors`}>
                        <td className="px-5 py-4 font-bold">{approval.tableName}</td>
                        <td className="px-5 py-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase ${isDark ? 'bg-white/10 text-axis-cream' : 'bg-axis-burgundy/5 text-axis-burgundy'
                            }`}>
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
                              title="View Semantic Layer"
                            >
                              <Eye className="w-3.5 h-3.5" /> View
                            </button>
                            <button
                              onClick={() => handleApprove(approval.tableName)}
                              className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 transition-colors flex items-center gap-1 font-bold text-[10px] uppercase border border-emerald-500/25"
                              title="Approve Table"
                            >
                              <Check className="w-3.5 h-3.5" /> Approve
                            </button>
                            <button
                              onClick={() => handleReject(approval.tableName)}
                              className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors flex items-center gap-1 font-bold text-[10px] uppercase border border-red-500/25"
                              title="Reject Table"
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

      {/* Semantic Layer Modal Popup */}
      {semanticModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full rounded-3xl p-6 shadow-2xl relative border ${isDark ? 'bg-axis-burgundy-dark text-white border-white/10' : 'bg-white text-gray-800 border-gray-200'
            }`}>
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
                <div className={`p-4 rounded-xl border space-y-1.5 transition-colors duration-400 ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-150'
                  }`}>
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
                        <th rowSpan={2} className="px-4 py-2.5 align-middle border border-black">Field Name</th>
                        <th rowSpan={2} className="px-4 py-2.5 align-middle border border-black">Business Name</th>
                        <th rowSpan={2} className="px-4 py-2.5 align-middle border border-black">Data Type</th>
                        <th rowSpan={2} className="px-4 py-2.5 align-middle border border-black">Description</th>
                        <th rowSpan={2} className="px-4 py-2.5 align-middle border border-black">Role</th>
                        <th rowSpan={2} className="px-4 py-2.5 align-middle border border-black">Classification</th>
                        <th colSpan={3} className="px-4 py-2 text-center border-b border border-black">Lineage</th>
                      </tr>
                      <tr className={`border-b dark:border-white/10 font-bold uppercase tracking-wider ${isDark ? 'bg-white/5 text-white/60' : 'bg-gray-50 text-gray-500'}`}>
                        <th className="px-4 py-2 text-xs border border-black">Source Columns</th>
                        <th className="px-4 py-2 text-xs border border-black">Source Tables</th>
                        <th className="px-4 py-2 text-xs border border-black">Transformation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-white/10">
                      {semanticData.fields?.map((field: any) => (
                        <tr key={field.field_name} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                          <td className="px-4 py-2.5 border border-black font-mono font-bold text-axis-red">{field.field_name}</td>
                          <td className="px-4 py-2.5 border border-black">{field.friendly_name}</td>
                          <td className="px-4 py-2.5 border border-black font-mono">{field.data_type}</td>
                          <td className="px-4 py-2.5 border border-black font-mono">{field.description}</td>
                          <td className="px-4 py-2.5 border border-black">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${field.role === 'identifier'
                              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                              : field.role === 'measure'
                                ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                                : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                              }`}>
                              {field.role}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 border border-black">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${field.classification === 'PII'
                              ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                              : 'bg-gray-500/10 text-gray-500 border border-gray-500/20'
                              }`}>
                              {field.classification}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-mono border border-black">{field.lineage?.source_columns?.join(", ") || ""}</td>
                          <td className="px-4 py-2.5 font-mono border border-black">{field.lineage?.source_tables?.join(", ") || ""}</td>
                          <td className="px-4 py-2.5 border border-black">{field.lineage?.transformation || ""}</td>
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

export default CreateTablePage;
