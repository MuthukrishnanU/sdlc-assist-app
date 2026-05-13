import React from 'react';
import { Terminal, Activity, Rocket, GitBranch, CheckCircle2 } from 'lucide-react';

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
    <div className="flex-1 p-8 overflow-y-auto bg-axis-gray">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-axis-red tracking-tight">
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
          <div className="flex items-center gap-2 text-axis-burgundy font-semibold uppercase text-xs tracking-widest">
            <Terminal className="w-4 h-4" /> Generated Code
          </div>
          <div className="bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-xl relative">
            <div className="flex items-center gap-1.5 px-4 py-3 bg-gray-50 border-b border-gray-200">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
            </div>
            <pre className={`p-6 font-mono text-sm leading-relaxed overflow-x-auto min-h-[300px] ${isLoading ? 'animate-pulse-subtle' : ''}`}>
              <code className="text-gray-700">
                {isLoading ? (
                  <span className="text-gray-400">Generating intelligent code structures...</span>
                ) : (
                  code || <span className="text-gray-400 italic">// Your generated code will appear here...</span>
                )}
              </code>
            </pre>
          </div>
        </section>

        {/* DQ Insights Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-axis-red font-semibold uppercase text-xs tracking-widest">
            <Activity className="w-4 h-4" /> Data Quality Insights
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Row Count', value: insights?.row_count, icon: HashIcon },
              { label: 'Null Values', value: insights?.null_values, color: 'text-red-600' },
              { label: 'Duplicate Rows', value: insights?.duplicate_rows, color: 'text-orange-600' },
              { label: 'Minimum', value: insights?.minimum },
              { label: 'Maximum', value: insights?.maximum },
              { label: 'Average', value: insights?.average },
            ].map((item, idx) => (
              <div key={idx} className="bg-white p-5 rounded-xl border border-gray-200 hover:border-axis-burgundy/30 transition-colors group shadow-sm">
                <div className="text-xs font-medium text-gray-500 mb-1">{item.label}</div>
                <div className={`text-2xl font-bold ${item.color || 'text-gray-900'} group-hover:scale-105 transition-transform origin-left`}>
                  {isLoading ? '...' : (item.value ?? '-')}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-200">
          <button className="px-6 py-2.5 rounded-xl bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold border border-gray-200 transition-all flex items-center gap-2">
            <Rocket className="w-4 h-4" /> Run Code
          </button>
          <button className="px-6 py-2.5 rounded-xl bg-axis-burgundy hover:brightness-110 text-white text-sm font-semibold shadow-lg shadow-axis-burgundy/20 transition-all flex items-center gap-2">
            <GitBranch className="w-4 h-4" /> Push to Bitbucket Repo
          </button>
        </div>
      </div>
    </div>
  );
};

const HashIcon = () => <span className="text-xs text-gray-500">#</span>;

export default MainSection;
