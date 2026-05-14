import React from 'react';
import { Terminal, Activity, Rocket, GitBranch, CheckCircle2 } from 'lucide-react';
import { useTheme } from '../ThemeContext';

interface DQInsights {
  row_count: number;
  null_values: number;
  duplicate_rows: number;
  minimum: number | null;
  maximum: number | null;
  average: number | null;
}

interface MainSectionProps {
  code: string | null;
  insights: DQInsights | null;
  isLoading: boolean;
}

const MainSection: React.FC<MainSectionProps> = ({ code, insights, isLoading }) => {
  const { isDark } = useTheme();

  return (
    <div className={`flex-1 p-8 overflow-y-auto transition-colors duration-400 ${isDark ? 'bg-axis-burgundy-deep' : 'bg-axis-gray'}`}>
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex justify-between items-center">
          <h1 className={`text-3xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-axis-red'}`}>
            Code Output & DQ Insights
          </h1>
          {code && (
            <div className="flex gap-2">
              <span className={`px-3 py-1 text-xs font-medium rounded-full flex items-center gap-1 ${
                isDark
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
              }`}>
                <CheckCircle2 className="w-3 h-3" /> Ready to deploy
              </span>
            </div>
          )}
        </header>

        {/* Generated Code Section */}
        <section className="space-y-4">
          <div className={`flex items-center gap-2 font-semibold uppercase text-xs tracking-widest ${isDark ? 'text-axis-cream' : 'text-axis-burgundy'}`}>
            <Terminal className="w-4 h-4" /> Generated Code
          </div>
          <div className={`rounded-2xl overflow-hidden shadow-xl relative transition-colors duration-400 ${
            isDark
              ? 'bg-axis-burgundy-dark/60 border border-white/10'
              : 'bg-white border border-gray-200'
          }`}>
            <div className={`flex items-center gap-1.5 px-4 py-3 border-b transition-colors duration-400 ${
              isDark ? 'bg-black/20 border-white/10' : 'bg-gray-50 border-gray-200'
            }`}>
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
            </div>
            <pre className={`p-6 font-mono text-sm leading-relaxed overflow-x-auto min-h-[300px] ${isLoading ? 'animate-pulse-subtle' : ''}`}>
              <code className={isDark ? 'text-gray-200' : 'text-gray-700'}>
                {isLoading ? (
                  <span className={isDark ? 'text-white/40' : 'text-gray-400'}>Generating intelligent code structures...</span>
                ) : (
                  code || <span className={`italic ${isDark ? 'text-white/30' : 'text-gray-400'}`}>// Your generated code will appear here...</span>
                )}
              </code>
            </pre>
          </div>
        </section>

        {/* DQ Insights Section */}
        <section className="space-y-4">
          <div className={`flex items-center gap-2 font-semibold uppercase text-xs tracking-widest ${isDark ? 'text-axis-cream' : 'text-axis-red'}`}>
            <Activity className="w-4 h-4" /> Data Quality Insights
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Row Count', value: insights?.row_count, icon: HashIcon },
              { label: 'Null Values', value: insights?.null_values, darkColor: 'text-red-400', lightColor: 'text-red-600' },
              { label: 'Duplicate Rows', value: insights?.duplicate_rows, darkColor: 'text-orange-400', lightColor: 'text-orange-600' },
              { label: 'Minimum', value: insights?.minimum },
              { label: 'Maximum', value: insights?.maximum },
              { label: 'Average', value: insights?.average },
            ].map((item, idx) => (
              <div key={idx} className={`p-5 rounded-xl transition-colors group shadow-sm duration-400 ${
                isDark
                  ? 'bg-axis-burgundy-dark/50 border border-white/10 hover:border-axis-red/40'
                  : 'bg-white border border-gray-200 hover:border-axis-burgundy/30'
              }`}>
                <div className={`text-xs font-medium mb-1 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>{item.label}</div>
                <div className={`text-2xl font-bold group-hover:scale-105 transition-transform origin-left ${
                  (isDark ? item.darkColor : item.lightColor) || (isDark ? 'text-white' : 'text-gray-900')
                }`}>
                  {isLoading ? '...' : (item.value ?? '-')}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Action Buttons */}
        <div className={`flex items-center justify-end gap-4 pt-4 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
          <button className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
            isDark
              ? 'bg-white/10 hover:bg-white/15 text-white border border-white/10'
              : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200'
          }`}>
            <Rocket className="w-4 h-4" /> Run Code
          </button>
          <button className={`px-6 py-2.5 rounded-xl text-white text-sm font-semibold shadow-lg hover:brightness-110 transition-all flex items-center gap-2 ${
            isDark
              ? 'bg-axis-red shadow-axis-red/20'
              : 'bg-axis-burgundy shadow-axis-burgundy/20'
          }`}>
            <GitBranch className="w-4 h-4" /> Push to Bitbucket Repo
          </button>
        </div>
      </div>
    </div>
  );
};

const HashIcon = () => <span className="text-xs text-gray-500">#</span>;

export default MainSection;
