import React from 'react';
import { Database, Code2, Layers, Type, Hash, Play, Sun, Moon } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import axios from 'axios';
import MultiSelect from './MultiSelect';
import CustomDropdown from './CustomDropdown';

interface InputSectionProps {
  onGenerate: (data: any) => void;
  isLoading: boolean;
  apiBaseUrl: string;
}

const InputSection: React.FC<InputSectionProps> = ({ onGenerate, isLoading, apiBaseUrl }) => {
  const { isDark, toggleTheme } = useTheme();
  const [dbMetadata, setDbMetadata] = React.useState<Record<string, string[]>>({
    'customerDetails': ['customer_id', 'first_name', 'last_name', 'email', 'phone', 'date_of_birth', 'kyc_status', 'credit_score', 'created_at'],
    'accountBalances': ['account_id', 'customer_id', 'account_type', 'current_balance', 'available_balance', 'currency', 'branch_code', 'last_updated', 'is_active'],
    'loanInfo': ['loan_id', 'customer_id', 'loan_type', 'principal_amount', 'interest_rate', 'tenure_months', 'start_date', 'loan_status', 'remaining_balance'],
    'transactionsInfo': ['transaction_id', 'account_id', 'customer_id', 'amount', 'transaction_type', 'channel', 'timestamp', 'merchant_name', 'status'],
    'dataQualityLogs': ['log_id', 'target_table', 'field_checked', 'rule_type', 'records_scanned', 'failed_count', 'execution_time_ms', 'run_date', 'status']
  });

  const [formData, setFormData] = React.useState({
    format: 'PySpark/SparkSQL',
    tables: [] as string[],
    columns: [] as string[],
    logic: '',
    sample_data_size: 100
  });

  React.useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const response = await axios.get(`${apiBaseUrl}/metadata`);
        const data = response.data;
        if (data && typeof data === 'object' && Object.keys(data).length > 0) {
          setDbMetadata(data);
        }
      } catch (err) {
        console.warn('Failed to fetch dynamic MongoDB metadata, using default static schema:', err);
      }
    };
    fetchMetadata();
  }, [apiBaseUrl]);

  const formats = ['PySpark/SparkSQL', 'SQL', 'Apache Iceberg', 'MongoDB NoSQL', 'Firestore SQL', 'Firestore NoSQL', 'BigQuery SQL', 'Snowflake SQL', 'Oracle SQL', 'Cassandra Query Language (CQL)', 'DynamoDB', 'PostgreSQL', 'MySQL'];
  const availableTables = Object.keys(dbMetadata);
  const availableColumns = React.useMemo(() => {
    return Array.from(new Set(formData.tables.flatMap(table => dbMetadata[table] || [])));
  }, [formData.tables, dbMetadata]);
  const sampleSizes = [100, 250, 500, 1000];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate(formData);
  };

  /*const toggleSelection = (field: 'tables' | 'columns', value: string) => {
    setFormData(prev => {
      const current = prev[field];
      const next = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [field]: next };
    });
  };*/

  return (
    <div className="flex flex-col h-full glass-sidebar p-6 w-80 shrink-0 overflow-y-auto">
      <div className="flex items-center gap-2 mb-8">
        <div className={`p-2 rounded-lg ${isDark ? 'bg-white/10' : 'bg-axis-burgundy/10'}`}>
          <Code2 className={`w-6 h-6 ${isDark ? 'text-axis-cream' : 'text-axis-burgundy'}`} />
        </div>
        <h2 className={`text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r ${isDark ? 'from-axis-cream to-axis-red' : 'from-axis-burgundy to-axis-red'}`}>
          SDLC Assist
        </h2>

        {/* Dark Mode Toggle */}
        <button
          onClick={toggleTheme}
          className={`ml-auto relative w-14 h-7 rounded-full transition-all duration-400 flex items-center ${isDark
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
              <Moon className="w-3 h-3 text-white" />
            ) : (
              <Sun className="w-3 h-3 text-amber-500" />
            )}
          </div>
        </button>
      </div>

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
          onChange={(val) => setFormData({ ...formData, sample_data_size: val })}
          icon={<Hash className={`w-3 h-3 ${isDark ? 'text-axis-cream' : 'text-axis-burgundy'}`} />}
        />

        {/* Logic in English */}
        <div className="space-y-2">
          <label className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-2 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
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
          disabled={isLoading}
          className={`w-full hover:brightness-110 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group ${isDark
            ? 'bg-gradient-to-r from-axis-red to-axis-burgundy shadow-lg shadow-black/30'
            : 'bg-gradient-to-r from-axis-burgundy to-axis-red shadow-lg shadow-axis-burgundy/20'
            }`}
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              Generate Code
              <Play className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default InputSection;
