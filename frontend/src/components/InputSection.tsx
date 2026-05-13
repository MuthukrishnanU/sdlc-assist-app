import React from 'react';
import { Database, Code2, Layers, Type, Hash, Play } from 'lucide-react';
import MultiSelect from './MultiSelect';

interface InputSectionProps {
  onGenerate: (data: any) => void;
  isLoading: boolean;
}

const InputSection: React.FC<InputSectionProps> = ({ onGenerate, isLoading }) => {
  const [formData, setFormData] = React.useState({
    format: 'SQL',
    tables: [] as string[],
    columns: [] as string[],
    logic: '',
    sample_data_size: 100
  });

  const formats = ['PySpark/SparkSQL', 'SQL', 'MongoDB NoSQL', 'Firestore SQL', 'Firestore NoSQL', 'BigQuery SQL', 'Snowflake SQL'];
  const availableTables = ['Customer_ID', 'Loan_Info', 'Transactions', 'Accounts'];
  const availableColumns = ['Customer_ID', 'Loan_Amount', 'Transaction_Date', 'Status', 'Balance'];
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
        <div className="p-2 bg-indigo-500/20 rounded-lg">
          <Code2 className="w-6 h-6 text-indigo-400" />
        </div>
        <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
          SDLC Assist
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Select Format */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-3 h-3" /> Select Format
          </label>
          <select
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
            value={formData.format}
            onChange={(e) => setFormData({ ...formData, format: e.target.value })}
          >
            {formats.map(f => <option key={f} value={f} className="bg-gray-900">{f}</option>)}
          </select>
        </div>

        {/* Select Tables */}
        <MultiSelect
          label="Select Tables"
          options={availableTables}
          selected={formData.tables}
          onChange={(selected) => setFormData({ ...formData, tables: selected })}
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

        {/* Logic in English */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Type className="w-3 h-3" /> Logic in English
          </label>
          <textarea
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm h-24 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all resize-none"
            placeholder="Describe your requirement..."
            value={formData.logic}
            onChange={(e) => setFormData({ ...formData, logic: e.target.value })}
          />
        </div>

        {/* Sample Data Size */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Hash className="w-3 h-3" /> Sample Data Size
          </label>
          <select
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
            value={formData.sample_data_size}
            onChange={(e) => setFormData({ ...formData, sample_data_size: parseInt(e.target.value) })}
          >
            {sampleSizes.map(size => <option key={size} value={size} className="bg-gray-900">{size}</option>)}
          </select>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-3 rounded-xl transition-all shadow-xl shadow-indigo-500/10 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
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
