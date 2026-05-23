import React from 'react';
import { Terminal, Activity, Rocket, GitBranch, CheckCircle2, Search, Info, Database } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import axios from 'axios';

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
  apiBaseUrl: string;
  formData: any | null;
}

const MainSection: React.FC<MainSectionProps> = ({ code, insights, isLoading, apiBaseUrl, formData }) => {
  const { isDark } = useTheme();
  const [displayedInsights, setDisplayedInsights] = React.useState<DQInsights | null>(null);
  const [simulatedData, setSimulatedData] = React.useState<any[]>([]);
  const [columnDetailsMap, setColumnDetailsMap] = React.useState<Record<string, any>>({});
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedColumn, setSelectedColumn] = React.useState('');
  const [isSimulating, setIsSimulating] = React.useState(false);
  const [isPushing, setIsPushing] = React.useState(false);

  React.useEffect(() => {
    setDisplayedInsights(null);
    setSimulatedData([]);
    setColumnDetailsMap({});
    setSearchQuery('');
    setSelectedColumn('');
    setIsPushing(false);
  }, [code]);

  const handleRunCode = async () => {
    if (!code || !formData) return;
    setIsSimulating(true);
    try {
      const response = await axios.post(`${apiBaseUrl}/simulate`, {
        tables: formData.tables,
        columns: formData.columns,
        sample_data_size: formData.sample_data_size
      });
      setSimulatedData(response.data.dataframe);
      setColumnDetailsMap(response.data.column_details);
      setDisplayedInsights(insights);
      if (formData.columns && formData.columns.length > 0) {
        setSelectedColumn(formData.columns[0]);
      }
    } catch (err) {
      console.error('Failed to run code simulation:', err);
      alert('Failed to simulate output. Make sure MongoDB database is seeded and backend is running.');
    } finally {
      setIsSimulating(false);
    }
  };

  const handlePushToGitHub = async () => {
    if (simulatedData.length === 0) {
      alert("No simulated data available to push. Click 'Run Code' first.");
      return;
    }
    setIsPushing(true);
    try {
      const response = await axios.post(`${apiBaseUrl}/github/push`, {
        dataframe: simulatedData,
        generated_code: code,
        format: formData?.format
      });
      if (response.data.status === 'success') {
        alert(
          `Successfully pushed to GitHub!\n` +
          `• Data table saved at: ${response.data.data_file_path}\n` +
          `• Generated code saved at: ${response.data.code_file_path}`
        );
        if (response.data.data_html_url) {
          window.open(response.data.data_html_url, '_blank');
        }
        if (response.data.code_html_url) {
          window.open(response.data.code_html_url, '_blank');
        }
      }
    } catch (err: any) {
      console.error('Failed to push to GitHub:', err);
      const errMsg = err.response?.data?.detail || err.message || 'Unknown error';
      alert(`Failed to push to GitHub: ${errMsg}`);
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <div className={`flex-1 p-8 overflow-y-auto transition-colors duration-400 ${isDark ? 'bg-axis-burgundy-deep' : 'bg-axis-gray'}`}>
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex justify-between items-center">
          <h1 className={`text-3xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-axis-red'}`}>
            Code Output & DQ Insights
          </h1>
          {code && (
            <div className="flex gap-2">
              <span className={`px-3 py-1 text-xs font-medium rounded-full flex items-center gap-1 ${isDark
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
          <div className={`rounded-2xl overflow-hidden shadow-xl relative transition-colors duration-400 ${isDark
            ? 'bg-axis-burgundy-dark/60 border border-white/10'
            : 'bg-white border border-gray-200'
            }`}>
            <div className={`flex items-center gap-1.5 px-4 py-3 border-b transition-colors duration-400 ${isDark ? 'bg-black/20 border-white/10' : 'bg-gray-50 border-gray-200'
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

        {/* Run Code Button Container */}
        <div className="flex justify-end">
          <button
            onClick={handleRunCode}
            disabled={!code || isSimulating || isLoading}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${isDark
              ? 'bg-white/10 hover:bg-white/15 text-white border border-white/10'
              : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200'
              }`}
          >
            {isSimulating ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Rocket className="w-4 h-4" />
            )}
            {isSimulating ? 'Simulating...' : 'Run Code'}
          </button>
        </div>

        {/* Output Simulation Section */}
        {simulatedData.length > 0 && (
          <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className={`flex items-center gap-2 font-semibold uppercase text-xs tracking-widest ${isDark ? 'text-axis-cream' : 'text-axis-burgundy'}`}>
              <Database className="w-4 h-4" /> Simulated Output Preview
            </div>

            {/* Controls Row */}
            <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-white/40' : 'text-gray-400'}`} />
                <input
                  type="text"
                  placeholder="Search simulated records..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-9 pr-4 py-2 text-sm rounded-xl focus:outline-none focus:ring-2 transition-all ${isDark
                      ? 'bg-white/10 border border-white/10 text-white placeholder-white/30 focus:ring-axis-red/30'
                      : 'bg-white border border-gray-200 text-gray-700 placeholder-gray-400 focus:ring-axis-burgundy/20'
                    }`}
                />
              </div>

              {/* Column Details Selector */}
              <div className="flex items-center gap-3">
                <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                  Inspect Column:
                </span>
                <select
                  value={selectedColumn}
                  onChange={(e) => setSelectedColumn(e.target.value)}
                  className={`px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 cursor-pointer transition-all ${isDark
                      ? 'bg-white/10 border border-white/10 text-white focus:ring-axis-red/30'
                      : 'bg-white border border-gray-200 text-gray-700 focus:ring-axis-burgundy/20'
                    }`}
                >
                  {Object.keys(columnDetailsMap).map((col) => (
                    <option key={col} value={col} className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Inspect Column Detail Card */}
            {selectedColumn && columnDetailsMap[selectedColumn] && (
              <div className={`p-4 rounded-xl border transition-colors duration-400 ${isDark
                  ? 'bg-axis-burgundy-dark/30 border-white/5 text-white'
                  : 'bg-white border-gray-100 text-gray-700'
                }`}>
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg mt-0.5 ${isDark ? 'bg-axis-red/10' : 'bg-axis-burgundy/5'}`}>
                    <Info className={`w-4 h-4 ${isDark ? 'text-axis-cream' : 'text-axis-burgundy'}`} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">
                      {columnDetailsMap[selectedColumn].friendly_name} <span className="font-mono text-xs opacity-50">({selectedColumn})</span>
                    </h4>
                    <p className={`text-xs mt-1 leading-relaxed ${isDark ? 'text-white/70' : 'text-gray-500'}`}>
                      {columnDetailsMap[selectedColumn].description}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${isDark ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-600'
                        }`}>
                        Type: {columnDetailsMap[selectedColumn].data_type}
                      </span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${isDark ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-600'
                        }`}>
                        Role: {columnDetailsMap[selectedColumn].role}
                      </span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${columnDetailsMap[selectedColumn].classification.toUpperCase() === 'PII' || columnDetailsMap[selectedColumn].classification.toUpperCase() === 'PRIVATE'
                          ? (isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-50 text-red-600')
                          : (isDark ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-600')
                        }`}>
                        Classification: {columnDetailsMap[selectedColumn].classification}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Table Component */}
            <div className={`rounded-2xl overflow-hidden shadow-xl border ${isDark ? 'bg-axis-burgundy-dark/40 border-white/10' : 'bg-white border-gray-200'
              }`}>
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-sm text-left">
                  <thead className={`text-xs uppercase tracking-wider transition-colors duration-400 border-b ${isDark ? 'bg-black/20 text-white/50 border-white/10' : 'bg-gray-50 text-gray-500 border-gray-200'
                    }`}>
                    <tr>
                      {formData?.columns.map((col: string) => (
                        <th key={col} scope="col" className="px-6 py-3 font-semibold">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className={`divide-y transition-colors duration-400 ${isDark ? 'divide-white/10 text-gray-200' : 'divide-gray-100 text-gray-700'
                    }`}>
                    {(() => {
                      const filtered = simulatedData.filter(row => {
                        if (!searchQuery) return true;
                        const query = searchQuery.toLowerCase();
                        return Object.values(row).some(val =>
                          val !== null && val !== undefined && String(val).toLowerCase().includes(query)
                        );
                      });

                      if (filtered.length === 0) {
                        return (
                          <tr>
                            <td colSpan={formData?.columns.length} className="px-6 py-8 text-center italic opacity-50">
                              No matching records found.
                            </td>
                          </tr>
                        );
                      }

                      return filtered.slice(0, 10).map((row, index) => (
                        <tr key={index} className={`hover:bg-black/5 transition-colors duration-200`}>
                          {formData?.columns.map((col: string) => (
                            <td key={col} className="px-6 py-3.5 font-mono text-xs whitespace-nowrap">
                              {row[col] !== null && row[col] !== undefined ? String(row[col]) : <span className="opacity-30">null</span>}
                            </td>
                          ))}
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
              <div className={`px-6 py-3 border-t text-xs font-semibold flex items-center justify-between ${isDark ? 'bg-black/10 border-white/10 text-white/40' : 'bg-gray-50 border-gray-100 text-gray-500'
                }`}>
                <span>
                  Showing up to 10 of {
                    simulatedData.filter(row => {
                      if (!searchQuery) return true;
                      const query = searchQuery.toLowerCase();
                      return Object.values(row).some(val =>
                        val !== null && val !== undefined && String(val).toLowerCase().includes(query)
                      );
                    }).length
                  } matching records (Simulated pool: {simulatedData.length})
                </span>
                {simulatedData.length > 10 && (
                  <span className="italic">Use the search box above to query other records</span>
                )}
              </div>
            </div>
          </section>
        )}

        {/* DQ Insights Section */}
        <section className="space-y-4">
          <div className={`flex items-center gap-2 font-semibold uppercase text-xs tracking-widest ${isDark ? 'text-axis-cream' : 'text-axis-red'}`}>
            <Activity className="w-4 h-4" /> Data Quality Insights
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Row Count', value: displayedInsights?.row_count, icon: HashIcon },
              { label: 'Null Values', value: displayedInsights?.null_values, darkColor: 'text-red-400', lightColor: 'text-red-600' },
              { label: 'Duplicate Rows', value: displayedInsights?.duplicate_rows, darkColor: 'text-orange-400', lightColor: 'text-orange-600' },
              { label: 'Minimum', value: displayedInsights?.minimum },
              { label: 'Maximum', value: displayedInsights?.maximum },
              { label: 'Average', value: displayedInsights?.average },
            ].map((item, idx) => (
              <div key={idx} className={`p-5 rounded-xl transition-colors group shadow-sm duration-400 ${isDark
                ? 'bg-axis-burgundy-dark/50 border border-white/10 hover:border-axis-red/40'
                : 'bg-white border border-gray-200 hover:border-axis-burgundy/30'
                }`}>
                <div className={`text-xs font-medium mb-1 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>{item.label}</div>
                <div className={`text-2xl font-bold group-hover:scale-105 transition-transform origin-left ${(isDark ? item.darkColor : item.lightColor) || (isDark ? 'text-white' : 'text-gray-900')
                  }`}>
                  {isLoading ? '...' : (item.value ?? '-')}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Action Buttons */}
        <div className={`flex items-center justify-end gap-4 pt-4 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
          <button
            onClick={handlePushToGitHub}
            disabled={isPushing || simulatedData.length === 0 || isLoading}
            className={`px-6 py-2.5 rounded-xl text-white text-sm font-semibold shadow-lg hover:brightness-110 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${isDark
              ? 'bg-axis-red shadow-axis-red/20'
              : 'bg-axis-burgundy shadow-axis-burgundy/20'
              }`}
          >
            {isPushing ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <GitBranch className="w-4 h-4" />
            )}
            {isPushing ? 'Pushing...' : 'Push to GitHub Repo'}
          </button>
        </div>
      </div>
    </div>
  );
};

const HashIcon = () => <span className="text-xs text-gray-500">#</span>;

export default MainSection;
