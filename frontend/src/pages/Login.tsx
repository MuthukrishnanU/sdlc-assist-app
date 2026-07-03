import React from 'react';
import { Lock, User, ShieldAlert, Code2, HelpCircle, ChevronDown, Key, Sun, Moon, X } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import axios from 'axios';

interface LoginPageProps {
  onLoginSuccess: (userId: string, role: string, canView: string, domain: string[]) => void;
  apiBaseUrl: string;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, apiBaseUrl }) => {
  const { isDark, toggleTheme } = useTheme();
  const [userId, setUserId] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [showHelper, setShowHelper] = React.useState(false);

  // Modal and Registration States
  const [isRbacModalOpen, setIsRbacModalOpen] = React.useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = React.useState(false);
  const [regUserId, setRegUserId] = React.useState('');
  const [regPassword, setRegPassword] = React.useState('');
  const [regRole, setRegRole] = React.useState('Business Analyst');
  const [regError, setRegError] = React.useState<string | null>(null);
  const [regSuccess, setRegSuccess] = React.useState<string | null>(null);
  const [regLoading, setRegLoading] = React.useState(false);

  const userIdRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    (!!userIdRef && !!userIdRef.current) && userIdRef.current.focus();
  }, []);

  const demoAccounts = [
    { role: 'Data Engineering', username: 'de_user_1', password: 'de_pass_1', desc: 'Access core Data Engineering tables' },
    { role: 'Healthcare', username: 'hc_user_1', password: 'hc_pass_1', desc: 'Access patients and clinical data' },
    { role: 'Media', username: 'media_user_1', password: 'media_pass_1', desc: 'Access subscriber and viewing logs' },
  ];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim() || !password.trim()) {
      setError('Please enter both User ID and Password.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.post(`${apiBaseUrl}/login`, {
        userId: userId.trim(),
        password: password.trim(),
      });

      if (response.data.status === 'success') {
        onLoginSuccess(
          response.data.userId,
          response.data.role,
          response.data.canView || 'both',
          response.data.domain || []
        );
      } else {
        setError('Login failed. Please try again.');
      }
    } catch (err: any) {
      console.error('Authentication error:', err);
      const message = err.response?.data?.detail || 'Invalid User ID or Password.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectDemo = (username: string, pass: string) => {
    setUserId(username);
    setPassword(pass);
    setError(null);
    setShowHelper(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regUserId.trim() || !regPassword.trim() || !regRole) {
      setRegError('All fields are mandatory.');
      return;
    }

    setRegLoading(true);
    setRegError(null);
    setRegSuccess(null);

    try {
      const response = await axios.post(`${apiBaseUrl}/register`, {
        userId: regUserId.trim(),
        password: regPassword.trim(),
        role: regRole,
      });

      if (response.data.status === 'success') {
        setRegSuccess(response.data.message || 'Registration successful - but pending admin approval');
        setRegUserId('');
        setRegPassword('');
      } else {
        setRegError('Registration failed. Please try again.');
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      const message = err.response?.data?.detail || 'Registration failed. Please try again.';
      setRegError(message);
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className={`flex items-center justify-center min-h-screen w-screen transition-colors duration-400 p-4 relative ${isDark ? 'bg-axis-burgundy-deep text-white' : 'bg-axis-gray text-gray-800'
      }`}>
      {/* Absolute theme toggle wrapper */}
      <div className="absolute top-6 right-6 z-20">
        <button
          onClick={toggleTheme}
          type="button"
          className={`relative w-14 h-7 rounded-full transition-all duration-400 flex items-center ${isDark
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

      {/* Background decoration elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-axis-red/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-axis-burgundy/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Branding header */}
        <div className="text-center space-y-2">
          <div className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transition-transform duration-300 hover:scale-105 ${isDark ? 'bg-white/10 text-axis-cream' : 'bg-axis-burgundy/10 text-axis-burgundy'
            }`}>
            <Code2 className="w-9 h-9" />
          </div>
          <h1 className={`text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r ${isDark ? 'from-axis-cream to-axis-red' : 'from-axis-burgundy to-axis-red'
            }`}>
            SDLC Assist/Conversational BI Portal
          </h1>
          <p className={`text-sm hidden font-medium ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
            Role-Based Access Control (RBAC) System
          </p>
        </div>

        {/* Form Container */}
        <div className={`p-8 rounded-3xl shadow-2xl glass transition-all border duration-400`}>
          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className={`p-4 rounded-xl flex items-start gap-3 border text-xs font-semibold animate-in fade-in slide-in-from-top-2 ${isDark
                ? 'bg-red-500/10 border-red-500/30 text-red-300'
                : 'bg-red-50 border-red-200 text-red-700'
                }`}>
                <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                <div>{error}</div>
              </div>
            )}

            {/* User ID Field */}
            <div className="space-y-2">
              <label className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                <User className="w-3.5 h-3.5" /> User ID
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Enter your user ID"
                  value={userId}
                  ref={userIdRef}
                  onChange={(e) => setUserId(e.target.value)}
                  className={`w-full rounded-xl pl-4 pr-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all ${isDark
                    ? 'bg-white/10 border border-white/10 text-white placeholder-white/30 focus:ring-axis-red/30'
                    : 'bg-white border border-gray-200 text-gray-700 placeholder-gray-400 focus:ring-axis-burgundy/20'
                    }`}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                <Lock className="w-3.5 h-3.5" /> Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full rounded-xl pl-4 pr-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all ${isDark
                    ? 'bg-white/10 border border-white/10 text-white placeholder-white/30 focus:ring-axis-red/30'
                    : 'bg-white border border-gray-200 text-gray-700 placeholder-gray-400 focus:ring-axis-burgundy/20'
                    }`}
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full hover:brightness-110 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group shadow-lg ${isDark
                ? 'bg-gradient-to-r from-axis-red to-axis-burgundy shadow-black/30'
                : 'bg-gradient-to-r from-axis-burgundy to-axis-red shadow-axis-burgundy/20'
                }`}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={() => {
                setRegUserId('');
                setRegPassword('');
                setRegRole('Business Analyst');
                setRegError(null);
                setRegSuccess(null);
                setIsRegisterModalOpen(true);
              }}
              className={`flex-1 text-center py-2.5 rounded-xl text-xs font-bold transition-all border ${isDark
                ? 'border-white/10 bg-white/5 hover:bg-white/10 text-white'
                : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                }`}
            >
              Register New User
            </button>
            <button
              type="button"
              onClick={() => setIsRbacModalOpen(true)}
              className={`flex-1 text-center py-2.5 rounded-xl text-xs font-bold transition-all border ${isDark
                ? 'border-white/10 bg-white/5 hover:bg-white/10 text-white'
                : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                }`}
            >
              RBAC Details
            </button>
          </div>

          {/* Quick Access Helper */}
          <div className="hidden mt-6 pt-6 border-t border-dashed border-gray-200/50 dark:border-white/10">
            <button
              type="button"
              onClick={() => setShowHelper(!showHelper)}
              className={`w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider py-1 hover:opacity-80 transition-opacity ${isDark ? 'text-white/50' : 'text-gray-500'
                }`}
            >
              <span className="flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5" /> Quick Access Demo Accounts
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showHelper ? 'rotate-180' : ''}`} />
            </button>

            {showHelper && (
              <div className="mt-3 space-y-2 animate-in fade-in slide-in-from-top-2">
                {demoAccounts.map((account) => (
                  <button
                    key={account.role}
                    type="button"
                    onClick={() => handleSelectDemo(account.username, account.password)}
                    className={`w-full text-left p-3 rounded-xl border text-xs transition-all flex items-start justify-between group hover:scale-[1.01] ${isDark
                      ? 'bg-white/5 border-white/5 hover:bg-white/10 text-white hover:border-axis-red/30'
                      : 'bg-gray-50 border-gray-100 hover:bg-gray-100 text-gray-700 hover:border-axis-burgundy/20'
                      }`}
                  >
                    <div>
                      <div className="font-bold flex items-center gap-1">
                        <Key className="w-3 h-3 text-axis-red" />
                        {account.role}
                      </div>
                      <div className={`mt-0.5 opacity-60`}>{account.desc}</div>
                    </div>
                    <div className="text-right font-mono font-semibold">
                      <div className="opacity-80">User: {account.username}</div>
                      <div className="opacity-60">Pass: {account.password}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RBAC Details Modal */}
      {isRbacModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-3xl rounded-3xl p-6 shadow-2xl relative border ${isDark ? 'bg-axis-burgundy-deep text-white border-white/10' : 'bg-white text-gray-800 border-gray-200'
            }`}>
            <button
              type="button"
              onClick={() => setIsRbacModalOpen(false)}
              className={`absolute top-4 right-4 p-1.5 rounded-lg hover:bg-black/10 transition-colors ${isDark ? 'text-white/60 hover:text-white' : 'text-gray-400 hover:text-gray-600'
                }`}
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className={`text-lg font-bold flex items-center gap-2 mb-4 ${isDark ? 'text-axis-cream' : 'text-axis-burgundy'}`}>
              <ShieldAlert className="w-5 h-5 text-axis-red" /> Role-Based Access Control (RBAC) Details
            </h3>

            <div className={`rounded-2xl overflow-hidden shadow-xl border ${isDark ? 'bg-axis-burgundy-dark/45 border-white/10' : 'bg-white border-gray-200'}`}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className={`text-[10px] uppercase tracking-wider border-b ${isDark ? 'bg-black/20 text-white/50 border-white/10' : 'bg-gray-55 text-gray-500 border-gray-200'
                    }`}>
                    <tr>
                      <th scope="col" className="px-6 py-3.5 font-semibold">Role</th>
                      <th scope="col" className="px-6 py-3.5 font-semibold">Domains</th>
                      <th scope="col" className="px-6 py-3.5 font-semibold">Application Access</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-white/10 text-gray-200' : 'divide-gray-100 text-gray-700'}`}>
                    {[
                      {
                        role: "Business Analyst",
                        domains: "Retail Banking, Healthcare, Digital Channels",
                        access: "SDLC Only"
                      },
                      {
                        role: "Data Engineer",
                        domains: "Data Engineering, Lending, Collections",
                        access: "SDLC Only"
                      },
                      {
                        role: "Data Scientist",
                        domains: "Cards, Media, Data Engineering",
                        access: "SDLC & Conversational BI"
                      },
                      {
                        role: "Lead",
                        domains: "Retail Banking, Lending, Collections",
                        access: "SDLC & Conversational BI"
                      },
                      {
                        role: "Project Lead",
                        domains: "Data Engineering, Healthcare, Media, Retail Banking, Lending, Cards, Digital Channels, Collections",
                        access: "Conversational BI only"
                      },
                      {
                        role: "Vertical Lead",
                        domains: "Data Engineering, Healthcare, Media, Retail Banking, Lending, Cards, Digital Channels, Collections",
                        access: "Conversational BI only"
                      }
                    ].map((item, idx) => (
                      <tr key={idx} className="hover:bg-black/5 transition-colors duration-200">
                        <td className="px-6 py-4 font-bold">{item.role}</td>
                        <td className="px-6 py-4 leading-relaxed">{item.domains}</td>
                        <td className="px-6 py-4 font-semibold text-axis-red">{item.access}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                type="button"
                onClick={() => setIsRbacModalOpen(false)}
                className={`px-5 py-2 rounded-xl text-xs font-bold text-white bg-axis-red hover:brightness-110 shadow-lg shadow-axis-red/20 transition-all`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Register New User Modal */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-md rounded-3xl p-6 shadow-2xl relative border transition-colors duration-400 ${isDark ? 'bg-axis-burgundy-deep text-white border-white/10' : 'bg-white text-gray-800 border-gray-200'
            }`}>
            <button
              type="button"
              onClick={() => setIsRegisterModalOpen(false)}
              className={`absolute top-4 right-4 p-1.5 rounded-lg hover:bg-black/10 transition-colors ${isDark ? 'text-white/60 hover:text-white' : 'text-gray-400 hover:text-gray-600'
                }`}
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className={`text-lg font-bold flex items-center gap-2 mb-2 ${isDark ? 'text-axis-cream' : 'text-axis-burgundy'}`}>
              Register New User
            </h3>
            <p className={`text-xs mb-6 ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
              Create a new user account with role-based domain access.
            </p>

            <form onSubmit={handleRegister} className="space-y-4">
              {regError && (
                <div className={`p-4 rounded-xl flex items-start gap-3 border text-xs font-semibold animate-in fade-in ${isDark ? 'bg-red-500/10 border-red-500/30 text-red-300' : 'bg-red-50 border-red-200 text-red-700'
                  }`}>
                  <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>{regError}</div>
                </div>
              )}

              {regSuccess && (
                <div className={`p-4 rounded-xl flex items-start gap-3 border text-xs font-semibold animate-in fade-in ${isDark ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-emerald-55 border-emerald-200 text-emerald-700'
                  }`}>
                  <div>{regSuccess}</div>
                </div>
              )}

              {/* User ID */}
              <div className="space-y-2">
                <label className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isDark ? 'text-white/50' : 'text-gray-550'}`}>
                  User ID
                </label>
                <input
                  type="text"
                  placeholder="Enter User ID"
                  value={regUserId}
                  onChange={(e) => setRegUserId(e.target.value)}
                  className={`w-full rounded-xl pl-4 pr-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all ${isDark
                    ? 'bg-white/10 border border-white/10 text-white focus:ring-axis-red/30 focus:border-axis-red/50'
                    : 'bg-white border border-gray-200 text-gray-700 focus:ring-axis-burgundy/20 focus:border-axis-burgundy/50'
                    }`}
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isDark ? 'text-white/50' : 'text-gray-550'}`}>
                  Password
                </label>
                <input
                  type="password"
                  placeholder="Enter Password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className={`w-full rounded-xl pl-4 pr-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all ${isDark
                    ? 'bg-white/10 border border-white/10 text-white focus:ring-axis-red/30 focus:border-axis-red/50'
                    : 'bg-white border border-gray-200 text-gray-700 focus:ring-axis-burgundy/20 focus:border-axis-burgundy/50'
                    }`}
                />
              </div>

              {/* Role */}
              <div className="space-y-2">
                <label className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isDark ? 'text-white/50' : 'text-gray-550'}`}>
                  Role
                </label>
                <select
                  value={regRole}
                  onChange={(e) => setRegRole(e.target.value)}
                  className={`w-full rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 transition-all cursor-pointer ${isDark
                    ? 'bg-white/10 border border-white/10 text-white focus:ring-axis-red/30'
                    : 'bg-white border border-gray-200 text-gray-700 focus:ring-axis-burgundy/20'
                    }`}
                >
                  {["Business Analyst", "Data Engineer", "Data Scientist", "Lead", "Project Lead", "Vertical Lead"].map(role => (
                    <option key={role} value={role} className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(false)}
                  className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all border ${isDark
                    ? 'border-white/10 bg-white/5 hover:bg-white/10 text-white'
                    : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                    }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={regLoading}
                  className="flex-1 py-3 rounded-xl text-xs font-bold text-white bg-axis-red hover:brightness-110 shadow-lg shadow-axis-red/20 transition-all flex items-center justify-center gap-2"
                >
                  {regLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Register'
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

export default LoginPage;
