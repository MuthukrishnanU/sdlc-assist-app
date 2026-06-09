import React from 'react';
import { Database, Code2, Layers, Type, Hash, Play, Cpu, AlertCircle, X } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import axios from 'axios';
import MultiSelect from './MultiSelect';
import CustomDropdown from './CustomDropdown';

interface InputSectionProps {
  onGenerate: (data: any) => void;
  isLoading: boolean;
  apiBaseUrl: string;
  user: { userId: string; role: string; canView: string; domain: string[] };
  onLogout: () => void;
  onCreateNewTable: () => void;
  activeTab: 'sdlc' | 'cbi';
  setActiveTab: (val: 'sdlc' | 'cbi') => void;
}

const InputSection: React.FC<InputSectionProps> = ({
  onGenerate,
  isLoading,
  apiBaseUrl,
  user,
  onLogout,
  onCreateNewTable,
  activeTab,
  setActiveTab
}) => {
  const { isDark } = useTheme();

  // SDLC Assist State
  const [dbMetadata, setDbMetadata] = React.useState<Record<string, string[]>>({});
  const [formData, setFormData] = React.useState({
    format: 'PySpark',
    tables: [] as string[],
    columns: [] as string[],
    logic: '',
    sample_data_size: 100,
    model: 'gpt-4o'
  });

  // CBI State
  const [cbiMetadata, setCbiMetadata] = React.useState<Record<string, { domain: string; columns: string[] }>>({});
  const [cbiFormData, setCbiFormData] = React.useState({
    domains: [] as string[],
    tables: [] as string[],
    columns: [] as string[],
    sample_data_size: 1000,
    model: 'gpt-4o',
    query: ''
  });

  const [isEstimateModalOpen, setIsEstimateModalOpen] = React.useState(false);
  const [estimateData, setEstimateData] = React.useState<any>(null);
  const [estimateLoading, setEstimateLoading] = React.useState(false);

  const handleConfirmGenerate = () => {
    setIsEstimateModalOpen(false);
    if (activeTab === 'sdlc') {
      onGenerate(formData);
    } else {
      onGenerate({
        format: 'SQL',
        tables: cbiFormData.tables,
        columns: cbiFormData.columns,
        logic: cbiFormData.query,
        sample_data_size: cbiFormData.sample_data_size || 1000,
        model: cbiFormData.model,
        domains: cbiFormData.domains
      });
    }
  };

  // Fetch SDLC metastore metadata
  React.useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const domainsParam = user.domain && user.domain.length > 0 ? user.domain.join(',') : '';
        const response = await axios.get(`${apiBaseUrl}/metadata?role=${user.role}&domains=${encodeURIComponent(domainsParam)}`);
        const data = response.data;
        if (data && typeof data === 'object' && Object.keys(data).length > 0) {
          setDbMetadata(data);
        }
      } catch (err) {
        console.warn('Failed to fetch dynamic MongoDB metadata:', err);
      }
    };
    fetchMetadata();
    setFormData(prev => ({
      ...prev,
      tables: [],
      columns: []
    }));
  }, [apiBaseUrl, user.role, user.domain]);

  // Fetch CBI metadata
  React.useEffect(() => {
    const fetchCbiMetadata = async () => {
      try {
        const response = await axios.get(`${apiBaseUrl}/cbi/metadata`);
        setCbiMetadata(response.data);
      } catch (err) {
        console.warn('Failed to fetch CBI metadata:', err);
      }
    };
    fetchCbiMetadata();
    setCbiFormData(prev => ({
      ...prev,
      domains: [],
      tables: [],
      columns: []
    }));
    console.log(availableCbiTables);
    console.log(availableCbiColumns);
  }, [apiBaseUrl, user.role]);

  const formats = ['PySpark', 'SparkSQL', 'SQL', 'PL/SQL', 'Apache Iceberg', 'MongoDB NoSQL', 'Firestore NoSQL', 'BigQuery SQL', 'Snowflake SQL', 'Oracle SQL', 'PostgreSQL', 'MySQL'];
  const availableTables = Object.keys(dbMetadata);
  const availableColumns = React.useMemo(() => {
    return Array.from(new Set(formData.tables.flatMap(table => dbMetadata[table] || [])));
  }, [formData.tables, dbMetadata]);

  const sampleSizes = [100, 250, 500, 1000];
  const models = ['gpt-4o', 'gemini-3.5-flash', 'mistral', 'llama', 'kimi'];

  // CBI dynamic dropdown mapping
  const availableCbiDomains = user.domain || [];

  const availableCbiTables = React.useMemo(() => {
    return Object.keys(cbiMetadata).filter(table =>
      cbiFormData.domains.includes(cbiMetadata[table].domain)
    );
  }, [cbiMetadata, cbiFormData.domains]);

  const availableCbiColumns = React.useMemo(() => {
    const cols = cbiFormData.tables.flatMap(table =>
      cbiMetadata[table]?.columns || []
    );
    return Array.from(new Set(cols));
  }, [cbiMetadata, cbiFormData.tables]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.logic.trim()) {
      alert("Please describe your query requirements in the logic section.");
      return;
    }
    setEstimateLoading(true);
    try {
      const response = await axios.post(`${apiBaseUrl}/generate/estimate`, {
        ...formData,
        role: user.role,
        userId: user.userId
      });
      setEstimateData(response.data);
      setIsEstimateModalOpen(true);
    } catch (err: any) {
      console.error('Failed to get token estimate:', err);
      const errMsg = err.response?.data?.detail || 'Failed to estimate token usage.';
      alert(errMsg);
    } finally {
      setEstimateLoading(false);
    }
  };

  const handleCbiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cbiFormData.domains.length === 0) {
      alert("Selecting Domain(s) is mandatory.");
      return;
    }
    if (!cbiFormData.query.trim()) {
      alert("Please describe your query requirements in the query section.");
      return;
    }
    setEstimateLoading(true);
    try {
      const response = await axios.post(`${apiBaseUrl}/generate/estimate`, {
        format: 'SQL',
        tables: cbiFormData.tables,
        columns: cbiFormData.columns,
        logic: cbiFormData.query,
        sample_data_size: cbiFormData.sample_data_size || 1000,
        model: cbiFormData.model,
        domains: cbiFormData.domains,
        role: user.role,
        userId: user.userId
      });
      setEstimateData(response.data);
      setIsEstimateModalOpen(true);
    } catch (err: any) {
      console.error('Failed to get token estimate:', err);
      const errMsg = err.response?.data?.detail || 'Failed to estimate token usage.';
      alert(errMsg);
    } finally {
      setEstimateLoading(false);
    }
  };

  const handleToggleTab = () => {
    if (user.canView === 'sdlc') {
      alert("Conversational BI page is not permissible for the logged in user.");
      return;
    }
    if (user.canView === 'cbi') {
      alert("SDLC Assist page is not permissible for the logged in user.");
      return;
    }
    // user.canView is 'both'
    const target = activeTab === 'sdlc' ? 'cbi' : 'sdlc';
    setActiveTab(target);
  };

  return (
    <div className="flex flex-col h-full glass-sidebar p-6 w-80 shrink-0 overflow-y-auto">
      <div className="flex items-center gap-2 mb-4 w-full">
        <div className={`p-2 rounded-lg ${isDark ? 'bg-white/10' : 'bg-axis-burgundy/10'}`}>
          {activeTab === 'sdlc' ? (
            <Code2 className={`w-6 h-6 ${isDark ? 'text-axis-cream' : 'text-axis-burgundy'}`} />
          ) : (
            <Database className={`w-6 h-6 ${isDark ? 'text-axis-cream' : 'text-axis-burgundy'}`} />
          )}
        </div>
        <h2 className={`text-base font-bold bg-clip-text text-transparent bg-gradient-to-r ${isDark ? 'from-axis-cream to-axis-red' : 'from-axis-burgundy to-axis-red'}`}>
          {activeTab === 'sdlc' ? 'SDLC Assist' : 'Conversational BI'}
        </h2>

        {/* Tab Toggle Switch */}
        <button
          onClick={handleToggleTab}
          type="button"
          className={`ml-auto relative w-12 h-6 rounded-full transition-all duration-350 flex items-center ${isDark ? 'bg-white/10 border border-white/10' : 'bg-gray-200 border border-gray-300'
            }`}
          title={activeTab === 'sdlc' ? 'Switch to Conversational BI' : 'Switch to SDLC Assist'}
        >
          <div
            className={`absolute w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300 ${activeTab === 'cbi' ? 'translate-x-[22px] bg-axis-red text-white' : 'translate-x-0.5 bg-axis-burgundy text-white'
              }`}
          >
            {activeTab === 'sdlc' ? (
              <Code2 className="w-2.5 h-2.5 text-white" />
            ) : (
              <Database className="w-2.5 h-2.5 text-white" />
            )}
          </div>
        </button>
      </div>

      {/* User profile card */}
      <div className={`mb-6 p-4 rounded-2xl border flex items-center justify-between transition-colors duration-400 ${isDark
        ? 'bg-white/5 border-white/10 text-white'
        : 'bg-gray-50 border-gray-200 text-gray-700'
        }`}>
        <div className="overflow-hidden">
          <div className="text-[10px] font-bold uppercase tracking-wider opacity-50">Profile</div>
          <div className="font-bold text-sm truncate" title={user.userId}>{user.userId}</div>
          <div className={`text-[9px] font-bold uppercase tracking-widest mt-1 px-2.5 py-0.5 rounded-full inline-block ${isDark ? 'bg-axis-red/20 text-axis-cream' : 'bg-axis-burgundy/10 text-axis-burgundy'}`}>
            {user.role}
          </div>
        </div>
        <button
          onClick={onLogout}
          type="button"
          className="ml-2 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-xs font-extrabold transition-all text-red-500"
          title="Sign Out"
        >
          Logout
        </button>
      </div>

      {activeTab === 'sdlc' ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Select Format */}
          <CustomDropdown
            label="Select Format"
            options={formats}
            value={formData.format}
            onChange={(val) => setFormData({ ...formData, format: val })}
            icon={<Layers className={`w-3 h-3 ${isDark ? 'text-axis-cream' : 'text-axis-burgundy'}`} />}
          />

          {/* Select Tables */}
          <MultiSelect
            label="Select Tables"
            options={availableTables}
            selected={formData.tables}
            onChange={(selected) => {
              const newAvailableColumns = Array.from(
                new Set(selected.flatMap(table => dbMetadata[table] || []))
              );
              const filteredColumns = formData.columns.filter(col => newAvailableColumns.includes(col));
              setFormData({
                ...formData,
                tables: selected,
                columns: filteredColumns
              });
            }}
            placeholder="Choose tables..."
            icon={<Database className="w-3 h-3" />}
            actionLink={
              <button
                type="button"
                onClick={onCreateNewTable}
                className={`text-xs font-bold underline tracking-wider transition-colors hover:opacity-80 focus:outline-none ${isDark ? 'text-axis-cream' : 'text-axis-burgundy'
                  }`}
              >
                (+) Metastore
              </button>
            }
          />

          {/* Select Columns */}
          <MultiSelect
            label="Select Columns"
            options={availableColumns}
            selected={formData.columns}
            onChange={(selected) => setFormData({ ...formData, columns: selected })}
            placeholder="Choose columns..."
            icon={<Type className="w-3 h-3" />}
          />

          {/* Sample Data Size */}
          <CustomDropdown
            label="Sample Data Size"
            options={sampleSizes}
            value={formData.sample_data_size}
            onChange={(val) => setFormData({ ...formData, sample_data_size: Number(val) })}
            icon={<Hash className={`w-3 h-3 ${isDark ? 'text-axis-cream' : 'text-axis-burgundy'}`} />}
          />

          {/* Select LLM Model */}
          <CustomDropdown
            label="Select LLM Model"
            options={models}
            value={formData.model}
            onChange={(val) => setFormData({ ...formData, model: val })}
            icon={<Cpu className={`w-3 h-3 ${isDark ? 'text-axis-cream' : 'text-axis-burgundy'}`} />}
          />

          {/* Logic in English */}
          <div className="space-y-2">
            <label className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-2 ${isDark ? 'text-white/50' : 'text-gray-550'}`}>
              <Type className={`w-3 h-3 ${isDark ? 'text-axis-cream' : 'text-axis-burgundy'}`} /> Logic in English
            </label>
            <textarea
              className={`w-full rounded-lg px-3 py-2 text-sm h-24 focus:outline-none focus:ring-2 transition-all resize-none ${isDark
                ? 'bg-white/10 border border-white/10 focus:ring-axis-red/30 text-white placeholder-white/30'
                : 'bg-white border border-gray-200 focus:ring-axis-burgundy/20 text-gray-700 placeholder-gray-400'
                }`}
              placeholder="Describe your requirement..."
              value={formData.logic}
              onChange={(e) => setFormData({ ...formData, logic: e.target.value })}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || estimateLoading}
            className={`w-full hover:brightness-110 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group ${isDark
              ? 'bg-gradient-to-r from-axis-red to-axis-burgundy shadow-lg shadow-black/30'
              : 'bg-gradient-to-r from-axis-burgundy to-axis-red shadow-lg shadow-axis-burgundy/20'
              }`}
          >
            {isLoading || estimateLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Generate Code
                <Play className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleCbiSubmit} className="space-y-6">
          {/* CBI: Select Domain */}
          <MultiSelect
            label="Select Domain"
            options={availableCbiDomains}
            selected={cbiFormData.domains}
            onChange={(selected) => {
              // Reset tables and columns that no longer belong to selected domains
              const activeTables = Object.keys(cbiMetadata).filter(table =>
                selected.includes(cbiMetadata[table].domain)
              );
              const filteredTables = cbiFormData.tables.filter(table => activeTables.includes(table));
              const activeCols = filteredTables.flatMap(table => cbiMetadata[table]?.columns || []);
              const filteredCols = cbiFormData.columns.filter(col => activeCols.includes(col));

              setCbiFormData({
                ...cbiFormData,
                domains: selected,
                tables: filteredTables,
                columns: filteredCols
              });
            }}
            placeholder="Choose domains..."
            icon={<Layers className="w-3 h-3" />}
          />

          {/* CBI: Select Tables 
          <MultiSelect
            label="Select Tables"
            options={availableCbiTables}
            selected={cbiFormData.tables}
            onChange={(selected) => {
              const activeCols = selected.flatMap(table => cbiMetadata[table]?.columns || []);
              const filteredCols = cbiFormData.columns.filter(col => activeCols.includes(col));
              setCbiFormData({
                ...cbiFormData,
                tables: selected,
                columns: filteredCols
              });
            }}
            placeholder="Choose tables..."
            icon={<Database className="w-3 h-3" />}
            actionLink={
              <button
                type="button"
                onClick={onCreateNewTable}
                className={`text-xs font-bold underline tracking-wider transition-colors hover:opacity-80 focus:outline-none ${isDark ? 'text-axis-cream' : 'text-axis-burgundy'
                  }`}
              >
                (+) Metastore
              </button>
            }
          />
          */}
          {/* CBI: Select Columns 
          <MultiSelect
            label="Select Columns"
            options={availableCbiColumns}
            selected={cbiFormData.columns}
            onChange={(selected) => setCbiFormData({ ...cbiFormData, columns: selected })}
            placeholder="Choose columns..."
            icon={<Type className="w-3 h-3" />}
          />
          */}
          {/* CBI: Sample Data Size
          <CustomDropdown
            label="Sample Data Size"
            options={[100, 250, 500, 1000]}
            value={cbiFormData.sample_data_size}
            onChange={(val) => setCbiFormData({ ...cbiFormData, sample_data_size: Number(val) })}
            icon={<Hash className={`w-3 h-3 ${isDark ? 'text-axis-cream' : 'text-axis-burgundy'}`} />}
          />
          */}
          {/* CBI: Select LLM */}
          <CustomDropdown
            label="Select LLM"
            options={['gpt-4o', 'gemini-3.5-flash', 'mistral', 'llama', 'kimi']}
            value={cbiFormData.model}
            onChange={(val) => setCbiFormData({ ...cbiFormData, model: val })}
            icon={<Cpu className={`w-3 h-3 ${isDark ? 'text-axis-cream' : 'text-axis-burgundy'}`} />}
          />

          {/* CBI: Query */}
          <div className="space-y-2">
            <label className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-2 ${isDark ? 'text-white/50' : 'text-gray-550'}`}>
              <Type className={`w-3 h-3 ${isDark ? 'text-axis-cream' : 'text-axis-burgundy'}`} /> Query
            </label>
            <textarea
              className={`w-full rounded-lg px-3 py-2 text-sm h-28 focus:outline-none focus:ring-2 transition-all resize-none ${isDark
                ? 'bg-white/10 border border-white/10 focus:ring-axis-red/30 text-white placeholder-white/30'
                : 'bg-white border border-gray-200 focus:ring-axis-burgundy/20 text-gray-700 placeholder-gray-400'
                }`}
              placeholder="Type your natural language query for code generation..."
              value={cbiFormData.query}
              onChange={(e) => setCbiFormData({ ...cbiFormData, query: e.target.value })}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || estimateLoading}
            className={`w-full hover:brightness-110 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group ${isDark
              ? 'bg-gradient-to-r from-axis-red to-axis-burgundy shadow-lg shadow-black/30'
              : 'bg-gradient-to-r from-axis-burgundy to-axis-red shadow-lg shadow-axis-burgundy/20'
              }`}
          >
            {isLoading || estimateLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Generate Code
                <Play className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </button>
        </form>
      )}

      {/* Token Usage Confirmation Modal */}
      {isEstimateModalOpen && estimateData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-md rounded-2xl p-6 shadow-2xl relative border ${isDark ? 'bg-axis-burgundy-dark text-white border-white/10' : 'bg-white text-gray-800 border-gray-200'
            }`}>
            <button
              type="button"
              onClick={() => setIsEstimateModalOpen(false)}
              className={`absolute top-4 right-4 p-1.5 rounded-lg hover:bg-black/10 transition-colors ${isDark ? 'text-white/60 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className={`text-lg font-bold flex items-center gap-2 mb-2 ${isDark ? 'text-axis-cream' : 'text-axis-burgundy'}`}>
              <AlertCircle className="w-5 h-5 text-amber-500 animate-pulse" /> Confirm Generation Cost
            </h3>
            <p className={`text-xs mb-6 ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
              Please review the estimated token consumption and query cost for your code generation.
            </p>

            <div className={`p-4 rounded-xl border space-y-3 mb-6 font-semibold text-xs transition-colors duration-400 ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-150'
              }`}>
              <div className="flex justify-between">
                <span className="opacity-60">LLM Model:</span>
                <span className="font-mono">{estimateData.model}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-60">Approx. Input Tokens:</span>
                <span>{estimateData.approx_input_tokens.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-60">Approx. Output Tokens:</span>
                <span>{estimateData.approx_output_tokens.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t pt-2 border-dashed border-gray-300 dark:border-white/10">
                <span className="opacity-60">Estimated Cost:</span>
                <span className="text-emerald-500">${estimateData.approx_cost_usd.toFixed(6)} USD</span>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsEstimateModalOpen(false)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${isDark
                  ? 'border-white/10 bg-white/5 hover:bg-white/10 text-white'
                  : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                  }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmGenerate}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-axis-red hover:brightness-110 shadow-lg shadow-axis-red/20 transition-all"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InputSection;
