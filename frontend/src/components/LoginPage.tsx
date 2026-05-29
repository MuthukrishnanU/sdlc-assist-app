import React from 'react';
import { Lock, User, ShieldAlert, Code2, HelpCircle, ChevronDown, Key, Sun, Moon } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import axios from 'axios';

interface LoginPageProps {
  onLoginSuccess: (userId: string, role: string) => void;
  apiBaseUrl: string;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, apiBaseUrl }) => {
  const { isDark, toggleTheme } = useTheme();
  const [userId, setUserId] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [showHelper, setShowHelper] = React.useState(false);

  const demoAccounts = [
    { role: 'Data Engineering', username: 'de_user_1', password: 'depass1', desc: 'Access core Data Engineering tables' },
    { role: 'Healthcare', username: 'hc_user_1', password: 'hcpass1', desc: 'Access patients and clinical data' },
    { role: 'Media', username: 'media_user_1', password: 'mediapass1', desc: 'Access subscriber and viewing logs' },
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
        onLoginSuccess(response.data.userId, response.data.role);
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
            SDLC Assist Portal
          </h1>
          <p className={`text-sm font-medium ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
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

          {/* Quick Access Helper */}
          <div className="mt-6 pt-6 border-t border-dashed border-gray-200/50 dark:border-white/10">
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
    </div>
  );
};

export default LoginPage;
