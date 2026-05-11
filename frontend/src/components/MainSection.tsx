import React from 'react';
import { Terminal, Activity, Rocket, GitBranch, CheckCircle2, AlertCircle } from 'lucide-react';

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
  return (
    <div className="flex-1 p-8 overflow-y-auto bg-[#0a0a0c]">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Code Output & DQ Insights
          </h1>
          {code && (
            <div className="flex gap-2">
              <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-medium rounded-full border border-emerald-500/20 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Ready to deploy
              </span>
            </div>
          )}
        </header>

        {/* Generated Code Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-indigo-400 font-semibold uppercase text-xs tracking-widest">
            <Terminal className="w-4 h-4" /> Generated Code
          </div>
          <div className="glass rounded-2xl overflow-hidden border border-white/5 shadow-2xl relative">
            <div className="flex items-center gap-1.5 px-4 py-3 bg-white/5 border-b border-white/5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
            </div>
            <pre className={`p-6 font-mono text-sm leading-relaxed overflow-x-auto min-h-[300px] ${isLoading ? 'animate-pulse-subtle' : ''}`}>
              <code className="text-gray-300">
                {isLoading ? (
                  <span className="text-gray-500">Generating intelligent code structures...</span>
                ) : (
                  code || <span className="text-gray-600 italic">// Your generated code will appear here...</span>
                )}
              </code>
            </pre>
          </div>
        </section>

        {/* DQ Insights Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-purple-400 font-semibold uppercase text-xs tracking-widest">
            <Activity className="w-4 h-4" /> Data Quality Insights
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Row Count', value: insights?.row_count, icon: HashIcon },
              { label: 'Null Values', value: insights?.null_values, color: 'text-red-400' },
              { label: 'Duplicate Rows', value: insights?.duplicate_rows, color: 'text-orange-400' },
              { label: 'Minimum', value: insights?.minimum },
              { label: 'Maximum', value: insights?.maximum },
              { label: 'Average', value: insights?.average },
            ].map((item, idx) => (
              <div key={idx} className="glass p-5 rounded-xl border border-white/5 hover:border-white/10 transition-colors group">
                <div className="text-xs font-medium text-gray-500 mb-1">{item.label}</div>
                <div className={`text-2xl font-bold ${item.color || 'text-white'} group-hover:scale-105 transition-transform origin-left`}>
                  {isLoading ? '...' : (item.value ?? '-')}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-4 pt-4 border-t border-white/5">
          <button className="px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-sm font-semibold border border-white/10 transition-all flex items-center gap-2">
            <Rocket className="w-4 h-4" /> Run Code
          </button>
          <button className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2">
            <GitBranch className="w-4 h-4" /> Push to Bitbucket Repo
          </button>
        </div>
      </div>
    </div>
  );
};

const HashIcon = () => <span className="text-xs text-gray-500">#</span>;

export default MainSection;
