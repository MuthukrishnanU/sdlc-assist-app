import React from 'react';
import { ArrowLeft, Shield, Trash2, Moon, Sun, CheckCircle, AlertTriangle, Edit2, X, LogOut } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import axios from 'axios';

interface AddNewPiiDataPageProps {
  user: { userId: string; role: string };
  onBack: () => void;
  apiBaseUrl: string;
  onLogout: () => void;
}

interface PiiParameterEntry {
  piiParameter: string;
  piiReason: string;
  piiPass: boolean;
  piiMask: boolean;
}

const AddNewPiiDataPage: React.FC<AddNewPiiDataPageProps> = ({ user, onBack, apiBaseUrl, onLogout }) => {
  const { isDark, toggleTheme } = useTheme();

  // Form states (Add Parameter)
  const [piiParameter, setPiiParameter] = React.useState('');
  const [piiReason, setPiiReason] = React.useState('');
  const [piiPass, setPiiPass] = React.useState(false);
  const [piiMask, setPiiMask] = React.useState(true);

  // UI/Status states
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // PII parameters list state
  const [piiList, setPiiList] = React.useState<PiiParameterEntry[]>([]);
  const [loadingList, setLoadingList] = React.useState(false);

  // Edit Modal states
  const [editingItem, setEditingItem] = React.useState<PiiParameterEntry | null>(null);
  const [editPiiParameter, setEditPiiParameter] = React.useState('');
  const [editPiiReason, setEditPiiReason] = React.useState('');
  const [editPiiPass, setEditPiiPass] = React.useState(false);
  const [editPiiMask, setEditPiiMask] = React.useState(true);
  const [isEditSubmitting, setIsEditSubmitting] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);

  // Fetch configured PII guardrail parameters
  const fetchPiiParameters = React.useCallback(async () => {
    setLoadingList(true);
    try {
      const response = await axios.get(`${apiBaseUrl}/admin/pii-guardrails`);
      setPiiList(response.data || []);
    } catch (err) {
      console.error('Failed to fetch PII parameters:', err);
    } finally {
      setLoadingList(false);
    }
  }, [apiBaseUrl]);

  React.useEffect(() => {
    console.log(user);
    fetchPiiParameters();
  }, [fetchPiiParameters]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parameterTrimmed = piiParameter.trim();
    const reasonTrimmed = piiReason.trim();

    if (!parameterTrimmed) {
      setStatusMessage({ type: 'error', text: 'PII Parameter name is required.' });
      return;
    }
    if (!reasonTrimmed) {
      setStatusMessage({ type: 'error', text: 'PII Reason is required.' });
      return;
    }
    if (reasonTrimmed.length > 50) {
      setStatusMessage({ type: 'error', text: 'PII Reason must not exceed 50 characters.' });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const response = await axios.post(`${apiBaseUrl}/admin/pii-guardrails`, {
        piiParameter: parameterTrimmed,
        piiReason: reasonTrimmed,
        piiPass: piiPass,
        piiMask: piiMask
      });

      if (response.data.status === 'success') {
        setStatusMessage({ type: 'success', text: response.data.message });
        setPiiParameter('');
        setPiiReason('');
        setPiiPass(false);
        setPiiMask(true);
        fetchPiiParameters(); // immediately refresh the list
      }
    } catch (err: any) {
      console.error('Failed to add PII parameter:', err);
      const errMsg = err.response?.data?.detail || 'An error occurred while adding the PII parameter.';
      setStatusMessage({ type: 'error', text: errMsg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (item: PiiParameterEntry) => {
    setEditingItem(item);
    setEditPiiParameter(item.piiParameter);
    setEditPiiReason(item.piiReason);
    setEditPiiPass(item.piiPass);
    setEditPiiMask(item.piiMask);
    setEditError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const paramTrimmed = editPiiParameter.trim();
    const reasonTrimmed = editPiiReason.trim();

    if (!paramTrimmed) {
      setEditError('PII Parameter name is required.');
      return;
    }
    if (!reasonTrimmed) {
      setEditError('PII Reason is required.');
      return;
    }
    if (reasonTrimmed.length > 50) {
      setEditError('PII Reason must not exceed 50 characters.');
      return;
    }

    setIsEditSubmitting(true);
    setEditError(null);

    try {
      // If the parameter name was renamed, delete the old rule key first to prevent duplicates
      if (paramTrimmed.toLowerCase() !== editingItem.piiParameter.toLowerCase()) {
        await axios.delete(`${apiBaseUrl}/admin/pii-guardrails/${encodeURIComponent(editingItem.piiParameter)}`);
      }

      const response = await axios.post(`${apiBaseUrl}/admin/pii-guardrails`, {
        piiParameter: paramTrimmed,
        piiReason: reasonTrimmed,
        piiPass: editPiiPass,
        piiMask: editPiiMask
      });

      if (response.data.status === 'success') {
        alert('PII Parameter updated successfully.');
        setEditingItem(null);
        fetchPiiParameters();
      }
    } catch (err: any) {
      console.error('Failed to update PII parameter:', err);
      const errMsg = err.response?.data?.detail || 'An error occurred while updating the PII parameter.';
      setEditError(errMsg);
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleDelete = async (param: string) => {
    if (!window.confirm(`Are you sure you want to delete the PII parameter restriction for "${param}"?`)) return;
    try {
      const response = await axios.delete(`${apiBaseUrl}/admin/pii-guardrails/${encodeURIComponent(param)}`);
      if (response.data.status === 'success') {
        alert(response.data.message);
        fetchPiiParameters(); // immediately refresh the list
      }
    } catch (err: any) {
      console.error('Failed to delete PII parameter:', err);
      alert(err.response?.data?.detail || 'Failed to delete PII parameter.');
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
                Configure PII Parameter
              </h1>
              <p className="text-xs opacity-60 mt-0.5">
                Configure PII parameters, allow dynamic approvals, and enforce data privacy masking inside query preview tables.
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
              <ArrowLeft className="w-4 h-4" /> Dashboard Menu
            </button>

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

        {/* Form and Status Card */}
        <div className={`p-6 rounded-3xl shadow-2xl border glass space-y-5 shrink-0`}>
          <h2 className="text-base font-bold flex items-center gap-2">
            <Shield className="w-4 h-4 text-axis-red" /> Define PII Guardrail Policy
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* PII Parameter Input */}
              <div className="space-y-1.5">
                <label className={`text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${isDark ? 'text-white/50' : 'text-gray-550'}`}>
                  PII Parameter Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. credit card, salary, address"
                  value={piiParameter}
                  onChange={(e) => setPiiParameter(e.target.value)}
                  className={`w-full rounded-xl pl-4 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all ${isDark
                    ? 'bg-white/10 border border-white/10 text-white placeholder-white/30 focus:ring-axis-red/30'
                    : 'bg-white border border-gray-200 text-gray-700 placeholder-gray-400 focus:ring-axis-burgundy/20'
                    }`}
                />
              </div>

              {/* PII Reason Textarea with max limit of 50 chars */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className={`text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${isDark ? 'text-white/50' : 'text-gray-550'}`}>
                    PII Reason
                  </label>
                  <span className={`text-[9px] font-mono opacity-50 ${piiReason.length > 50 ? 'text-axis-red font-bold' : ''}`}>
                    {piiReason.length}/50
                  </span>
                </div>
                <textarea
                  placeholder="Reason for blocking (max 50 characters)..."
                  value={piiReason}
                  maxLength={50}
                  onChange={(e) => setPiiReason(e.target.value)}
                  className={`w-full rounded-xl px-4 py-2.5 text-sm h-[42px] focus:outline-none focus:ring-2 transition-all resize-none ${isDark
                    ? 'bg-white/10 border border-white/10 text-white placeholder-white/30 focus:ring-axis-red/30'
                    : 'bg-white border border-gray-200 text-gray-700 placeholder-gray-400 focus:ring-axis-burgundy/20'
                    }`}
                />
              </div>

              {/* PII Pass */}
              <div className="space-y-1.5">
                <label className={`text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${isDark ? 'text-white/50' : 'text-gray-550'}`}>
                  PII Pass (Allow Query Approval)
                </label>
                <select
                  value={piiPass ? "true" : "false"}
                  onChange={(e) => setPiiPass(e.target.value === "true")}
                  className={`w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all cursor-pointer ${isDark
                    ? 'bg-white/10 border border-white/10 text-white focus:ring-axis-red/30'
                    : 'bg-white border border-gray-200 text-gray-700 focus:ring-axis-burgundy/20'
                    }`}
                >
                  <option value="false" className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>
                    False (Strictly block query)
                  </option>
                  <option value="true" className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>
                    True (Allow query validation)
                  </option>
                </select>
              </div>

              {/* PII Mask */}
              <div className="space-y-1.5">
                <label className={`text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${isDark ? 'text-white/50' : 'text-gray-550'}`}>
                  PII Mask (Enforce Output Masking)
                </label>
                <select
                  value={piiMask ? "true" : "false"}
                  onChange={(e) => setPiiMask(e.target.value === "true")}
                  className={`w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all cursor-pointer ${isDark
                    ? 'bg-white/10 border border-white/10 text-white focus:ring-axis-red/30'
                    : 'bg-white border border-gray-200 text-gray-700 focus:ring-axis-burgundy/20'
                    }`}
                >
                  <option value="true" className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>
                    True (Enforce masking in output)
                  </option>
                  <option value="false" className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>
                    False (Display raw unmasked data)
                  </option>
                </select>
              </div>
            </div>

            {/* Submit button */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className={`px-6 py-2.5 rounded-xl font-bold text-xs text-white hover:brightness-110 shadow-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${isDark
                  ? 'bg-gradient-to-r from-axis-red to-axis-burgundy shadow-black/30'
                  : 'bg-gradient-to-r from-axis-burgundy to-axis-red shadow-axis-burgundy/20'
                  }`}
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Shield className="w-4 h-4" /> Save Guardrail Parameter
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Table List Section (Bottom) */}
        <div className={`p-6 rounded-3xl shadow-2xl border glass flex-grow flex flex-col space-y-4 min-h-[300px]`}>
          <div className="flex items-center justify-between pb-3 border-b border-gray-200/50 dark:border-white/10 shrink-0">
            <h2 className="text-base font-extrabold flex items-center gap-2">
              <Shield className="w-5 h-5 text-axis-red" /> Configured Guardrail List
            </h2>
            <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full ${piiList.length > 0
              ? (isDark ? 'bg-axis-red/25 text-axis-cream' : 'bg-axis-burgundy/10 text-axis-burgundy')
              : (isDark ? 'bg-white/10 text-white/50' : 'bg-gray-100 text-gray-500')
              }`}>
              {piiList.length} rules
            </span>
          </div>

          {loadingList ? (
            <div className="flex flex-col items-center justify-center flex-grow py-12 space-y-2">
              <div className="w-8 h-8 border-4 border-axis-red/20 border-t-axis-red rounded-full animate-spin" />
              <span className="text-xs opacity-60 font-bold">Fetching parameters list...</span>
            </div>
          ) : piiList.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-grow py-12 text-center space-y-2">
              <div className={`p-3.5 rounded-full w-fit ${isDark ? 'bg-white/5 text-white/30' : 'bg-gray-50 text-gray-400'}`}>
                <Shield className="w-6 h-6" />
              </div>
              <div className="text-sm font-bold opacity-60">No Active PII Parameters</div>
              <p className="text-[10px] opacity-40 max-w-xs mx-auto">
                Logic prompts containing any terms will currently pass this specific guardrail check.
              </p>
            </div>
          ) : (
            <div className="overflow-y-auto flex-grow rounded-2xl border dark:border-white/10 max-h-[35vh] custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className={`border-b dark:border-white/10 font-bold uppercase tracking-wider sticky top-0 z-10 ${isDark ? 'bg-axis-burgundy-dark text-white/60' : 'bg-gray-50 text-gray-500'
                    }`}>
                    <th className="px-5 py-3 w-[100px] text-center">Actions</th>
                    <th className="px-5 py-3 w-[180px]">PII Parameter</th>
                    <th className="px-5 py-3">PII Reason</th>
                    <th className="px-4 py-3 w-[90px] text-center">PII Pass</th>
                    <th className="px-4 py-3 w-[90px] text-center">PII Mask</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-white/10 font-medium">
                  {piiList.map((item) => (
                    <tr key={item.piiParameter} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      <td className="px-5 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleEditClick(item)}
                            className="p-1.5 rounded-lg text-axis-red hover:bg-axis-red/10 border border-transparent hover:border-axis-red/20 transition-all active:scale-95"
                            title="Edit parameter restriction"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.piiParameter)}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all active:scale-95"
                            title="Delete parameter restriction"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-bold text-axis-red font-mono">{item.piiParameter}</td>
                      <td className="px-5 py-4 opacity-80 max-w-xs truncate" title={item.piiReason}>{item.piiReason}</td>
                      <td className="px-4 py-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase ${item.piiPass
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-red-500/15 text-red-400'
                          }`}>
                          {String(item.piiPass)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase ${item.piiMask
                          ? 'bg-amber-500/15 text-amber-400'
                          : 'bg-gray-500/15 text-gray-400'
                          }`}>
                          {String(item.piiMask)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Edit Parameter Modal Popup */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-lg rounded-3xl p-6 shadow-2xl relative border ${isDark ? 'bg-axis-burgundy-dark text-white border-white/10' : 'bg-white text-gray-800 border-gray-200'
            }`}>
            <button
              type="button"
              onClick={() => setEditingItem(null)}
              className={`absolute top-4 right-4 p-1.5 rounded-lg hover:bg-black/10 transition-colors ${isDark ? 'text-white/60 hover:text-white' : 'text-gray-400 hover:text-gray-600'
                }`}
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className={`text-lg font-bold flex items-center gap-2 mb-1 ${isDark ? 'text-axis-cream' : 'text-axis-burgundy'}`}>
              <Shield className="w-5 h-5 text-axis-red" /> Edit PII Guardrail Policy
            </h3>
            <p className={`text-xs mb-4 ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
              Update policy terms, approval status, and masking configuration for this parameter.
            </p>

            {editError && (
              <div className={`p-3.5 mb-4 rounded-xl flex items-start gap-2.5 border text-xs font-semibold ${isDark ? 'bg-red-500/10 border-red-500/30 text-red-300' : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>{editError}</div>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="space-y-4">
                {/* Edit Parameter Name */}
                <div className="space-y-1.5">
                  <label className={`text-[10px] font-extrabold uppercase tracking-wider ${isDark ? 'text-white/50' : 'text-gray-550'}`}>
                    PII Parameter Name
                  </label>
                  <input
                    type="text"
                    value={editPiiParameter}
                    onChange={(e) => setEditPiiParameter(e.target.value)}
                    className={`w-full rounded-xl pl-4 pr-4 py-2 text-sm focus:outline-none focus:ring-2 transition-all ${isDark
                      ? 'bg-white/10 border border-white/10 text-white placeholder-white/30 focus:ring-axis-red/30'
                      : 'bg-white border border-gray-200 text-gray-700 placeholder-gray-400 focus:ring-axis-burgundy/20'
                      }`}
                  />
                </div>

                {/* Edit PII Reason */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className={`text-[10px] font-extrabold uppercase tracking-wider ${isDark ? 'text-white/50' : 'text-gray-550'}`}>
                      PII Reason
                    </label>
                    <span className={`text-[9px] font-mono opacity-50 ${editPiiReason.length > 50 ? 'text-axis-red font-bold' : ''}`}>
                      {editPiiReason.length}/50
                    </span>
                  </div>
                  <textarea
                    value={editPiiReason}
                    maxLength={50}
                    onChange={(e) => setEditPiiReason(e.target.value)}
                    className={`w-full rounded-xl px-4 py-2 text-sm h-[42px] focus:outline-none focus:ring-2 transition-all resize-none ${isDark
                      ? 'bg-white/10 border border-white/10 text-white placeholder-white/30 focus:ring-axis-red/30'
                      : 'bg-white border border-gray-200 text-gray-700 placeholder-gray-400 focus:ring-axis-burgundy/20'
                      }`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Edit PII Pass */}
                  <div className="space-y-1.5">
                    <label className={`text-[10px] font-extrabold uppercase tracking-wider ${isDark ? 'text-white/50' : 'text-gray-555'}`}>
                      PII Pass
                    </label>
                    <select
                      value={editPiiPass ? "true" : "false"}
                      onChange={(e) => setEditPiiPass(e.target.value === "true")}
                      className={`w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-all cursor-pointer ${isDark
                        ? 'bg-white/10 border border-white/10 text-white focus:ring-axis-red/30'
                        : 'bg-white border border-gray-200 text-gray-700 focus:ring-axis-burgundy/20'
                        }`}
                    >
                      <option value="false">False (Block query)</option>
                      <option value="true">True (Allow query)</option>
                    </select>
                  </div>

                  {/* Edit PII Mask */}
                  <div className="space-y-1.5">
                    <label className={`text-[10px] font-extrabold uppercase tracking-wider ${isDark ? 'text-white/50' : 'text-gray-555'}`}>
                      PII Mask
                    </label>
                    <select
                      value={editPiiMask ? "true" : "false"}
                      onChange={(e) => setEditPiiMask(e.target.value === "true")}
                      className={`w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-all cursor-pointer ${isDark
                        ? 'bg-white/10 border border-white/10 text-white focus:ring-axis-red/30'
                        : 'bg-white border border-gray-200 text-gray-700 focus:ring-axis-burgundy/20'
                        }`}
                    >
                      <option value="true">True (Mask output)</option>
                      <option value="false">False (No masking)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${isDark
                    ? 'border-white/10 bg-white/5 hover:bg-white/10 text-white'
                    : 'border-gray-200 bg-white hover:bg-gray-55 text-gray-700'
                    }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isEditSubmitting}
                  className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all flex items-center justify-center gap-1.5 ${isDark
                    ? 'bg-axis-red hover:brightness-110 shadow-lg shadow-axis-red/20'
                    : 'bg-axis-burgundy hover:brightness-110 shadow-lg shadow-axis-burgundy/20'
                    }`}
                >
                  {isEditSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddNewPiiDataPage;
