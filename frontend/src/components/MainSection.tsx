import React from 'react';
import { Terminal, Activity, Rocket, GitBranch, CheckCircle2, Search, Info, Database, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Download, X, Cpu, Coins } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import axios from 'axios';

interface DQInsights {
  row_count: number;
  null_values: number;
  duplicate_rows: number;
  minimum: number | null;
  maximum: number | null;
  average: number | null;
  distinct_values: number;
  empty_strings: number;
}

interface MainSectionProps {
  code: string | null;
  insights: DQInsights | null;
  isLoading: boolean;
  apiBaseUrl: string;
  formData: any | null;
  generationTokens: { prompt_tokens: number; completion_tokens: number } | null;
  user?: { userId: string; role: string } | null;
}

const MainSection: React.FC<MainSectionProps> = ({ code, insights, isLoading, apiBaseUrl, formData, generationTokens, user }) => {
  const { isDark } = useTheme();
  const [outputTableInsights, setOutputTableInsights] = React.useState<DQInsights | null>(null);
  const [tableInsightsMap, setTableInsightsMap] = React.useState<Record<string, DQInsights>>({});
  const [selectedDqTable, setSelectedDqTable] = React.useState<string>('Output Table');
  const [selectedDqColumn, setSelectedDqColumn] = React.useState<string>('');
  const [simulationData, setSimulationData] = React.useState<any>(null);
  const [simulatedData, setSimulatedData] = React.useState<any[]>([]);
  const [columnDetailsMap, setColumnDetailsMap] = React.useState<Record<string, any>>({});
  const [searchQuery, setSearchQuery] = React.useState('');
  const [smartFilterQuery, setSmartFilterQuery] = React.useState('');
  const [sortColumn, setSortColumn] = React.useState<string | null>(null);
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc' | null>(null);
  const [selectedColumn, setSelectedColumn] = React.useState('');
  const [isSimulating, setIsSimulating] = React.useState(false);
  const [isPushing, setIsPushing] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [isExplanationOpen, setIsExplanationOpen] = React.useState(false);

  const [isConsumptionModalOpen, setIsConsumptionModalOpen] = React.useState(false);
  const [consumptionData, setConsumptionData] = React.useState<any[]>([]);
  const [consumptionLoading, setConsumptionLoading] = React.useState(false);

  const fetchRoleTokenConsumption = async () => {
    if (!user) return;
    setConsumptionLoading(true);
    try {
      const response = await axios.get(`${apiBaseUrl}/role-token-consumption?role=${user.role}`);
      setConsumptionData(response.data);
      setIsConsumptionModalOpen(true);
    } catch (err) {
      console.error('Failed to fetch role token consumption logs:', err);
      alert('Failed to retrieve role token consumption logs.');
    } finally {
      setConsumptionLoading(false);
    }
  };

  const [isQuotaModalOpen, setIsQuotaModalOpen] = React.useState(false);
  const [quotaData, setQuotaData] = React.useState<any>(null);
  const [quotaLoading, setQuotaLoading] = React.useState(false);

  const fetchQuota = async () => {
    if (!user) return;
    setQuotaLoading(true);
    try {
      const response = await axios.get(`${apiBaseUrl}/quota?role=${user.role}`);
      setQuotaData(response.data);
      setIsQuotaModalOpen(true);
    } catch (err) {
      console.error('Failed to fetch model quota details:', err);
      alert('Failed to retrieve model quota limits.');
    } finally {
      setQuotaLoading(false);
    }
  };

  React.useEffect(() => {
    if (columnDetailsMap && Object.keys(columnDetailsMap).length > 0) {
      const firstSelectedCol = formData?.columns?.find((col: string) => col in columnDetailsMap);
      if (firstSelectedCol) {
        setSelectedColumn(firstSelectedCol);
      } else {
        setSelectedColumn(Object.keys(columnDetailsMap)[0]);
      }
    } else {
      setSelectedColumn('');
    }
  }, [columnDetailsMap, formData]);

  // GitHub push configuration states
  const [podName, setPodName] = React.useState('Personalisation');
  const [projectName, setProjectName] = React.useState('sdlc-data-engineering');
  const [dataFileName, setDataFileName] = React.useState('');
  const [queryFileName, setQueryFileName] = React.useState('');

  React.useEffect(() => {
    setOutputTableInsights(insights);
    setIsExplanationOpen(false);
    setTableInsightsMap({});
    setSelectedDqTable('Output Table');
    setSelectedDqColumn('');
    setSimulationData(null);
    setSimulatedData([]);
    setColumnDetailsMap({});
    setSearchQuery('');
    setSmartFilterQuery('');
    setSortColumn(null);
    setSortDirection(null);
    setSelectedColumn('');
    setIsPushing(false);
    setCurrentPage(1);

    // Reset GitHub push options
    setPodName('Personalisation');
    setProjectName('sdlc-data-engineering');
    setDataFileName('');
    setQueryFileName('');
    console.log(outputTableInsights);
    console.log(tableInsightsMap);
  }, [code, insights]);

  // Dynamically default the selected column to the primary key when table selection or simulation data changes
  React.useEffect(() => {
    if (!simulationData) {
      setSelectedDqColumn('');
      return;
    }
    const cols = Object.keys(simulationData.column_dq_insights?.[selectedDqTable] || {});
    const pk = simulationData.primary_keys?.[selectedDqTable];
    if (pk && cols.includes(pk)) {
      setSelectedDqColumn(pk);
    } else if (cols.length > 0) {
      setSelectedDqColumn(cols[0]);
    } else {
      setSelectedDqColumn('');
    }
  }, [selectedDqTable, simulationData]);

  const availableDqColumns = React.useMemo(() => {
    if (!simulationData) return [];
    return Object.keys(simulationData.column_dq_insights?.[selectedDqTable] || {});
  }, [selectedDqTable, simulationData]);

  const activeInsights = React.useMemo(() => {
    if (!simulationData) return null;
    return simulationData.column_dq_insights?.[selectedDqTable]?.[selectedDqColumn] || null;
  }, [selectedDqTable, selectedDqColumn, simulationData]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, smartFilterQuery, sortColumn, sortDirection]);

  const handleHeaderClick = (colName: string) => {
    if (sortColumn !== colName) {
      setSortColumn(colName);
      setSortDirection('asc');
    } else {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortDirection(null);
        setSortColumn(null);
      }
    }
  };

  const filteredRecords = React.useMemo(() => {
    // 1. First, apply global search
    let records = simulatedData.filter(row => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return Object.values(row).some(val =>
        val !== null && val !== undefined && String(val).toLowerCase().includes(query)
      );
    });

    // 2. Next, apply smart column filters
    let parsedFilters: Record<string, string> = {};
    try {
      if (smartFilterQuery.trim()) {
        const parsed = JSON.parse(smartFilterQuery);
        if (typeof parsed === 'object' && parsed !== null) {
          Object.keys(parsed).forEach(key => {
            parsedFilters[key.toLowerCase()] = String(parsed[key]).toLowerCase();
          });
        }
      }
    } catch (e) {
      // Ignore invalid JSON while typing
    }

    if (Object.keys(parsedFilters).length > 0) {
      records = records.filter(row => {
        return Object.keys(parsedFilters).every(filterKey => {
          const rowKey = Object.keys(row).find(k => k.toLowerCase() === filterKey);
          if (!rowKey) return false;
          const cellValue = row[rowKey];
          if (cellValue === null || cellValue === undefined) return false;
          return String(cellValue).toLowerCase().includes(parsedFilters[filterKey]);
        });
      });
    }

    // 3. Finally, apply sorting
    if (sortColumn && sortDirection) {
      records = [...records].sort((a, b) => {
        const valA = a[sortColumn];
        const valB = b[sortColumn];

        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;

        // Determine if they are numeric
        const numA = Number(valA);
        const numB = Number(valB);
        if (!isNaN(numA) && !isNaN(numB)) {
          return sortDirection === 'asc' ? numA - numB : numB - numA;
        }

        // String comparison
        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        return sortDirection === 'asc'
          ? strA.localeCompare(strB)
          : strB.localeCompare(strA);
      });
    }

    return records;
  }, [simulatedData, searchQuery, smartFilterQuery, sortColumn, sortDirection]);

  const totalPages = Math.ceil(filteredRecords.length / 10);

  const displayedColumns = React.useMemo(() => {
    return Object.keys(columnDetailsMap);
  }, [columnDetailsMap]);

  const paginatedRecords = React.useMemo(() => {
    const startIndex = (currentPage - 1) * 10;
    return filteredRecords.slice(startIndex, startIndex + 10);
  }, [filteredRecords, currentPage]);

  const handleRunCode = async () => {
    if (!code || !formData) return;
    setIsSimulating(true);
    try {
      const response = await axios.post(`${apiBaseUrl}/simulate`, {
        tables: formData.tables,
        columns: formData.columns,
        sample_data_size: formData.sample_data_size,
        logic: formData.logic,
        generated_code: code,
        format: formData.format,
        model: formData.model
      });
      setSimulationData(response.data);
      setSimulatedData(response.data.dataframe);
      setColumnDetailsMap(response.data.column_details);
      setOutputTableInsights(response.data.dq_insights);
      if (response.data.table_dq_insights) {
        setTableInsightsMap(response.data.table_dq_insights);
      }
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
        format: formData?.format,
        pod_name: podName,
        project_name: projectName,
        data_file_name: dataFileName.trim() || undefined,
        query_file_name: queryFileName.trim() || undefined,
        userId: user?.userId,
        role: user?.role,
        input_fields: formData,
        column_dq_insights: simulationData?.column_dq_insights,
        dq_insights: simulationData?.dataframe
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
      console.log(err)
      const errMsg = err.response?.data?.detail || err.message || 'Unknown error';
      alert(`Failed to push to GitHub: ${errMsg}`);
    } finally {
      setIsPushing(false);
    }
  };

  const handleExport = (format: string) => {
    if (simulatedData.length === 0) return;

    // Get columns
    const columns = Object.keys(columnDetailsMap);
    if (columns.length === 0) return;

    const filename = `simulated_output_${new Date().toISOString()}`;

    if (format === 'CSV') {
      // Create CSV
      const header = columns.join(',');
      const rows = simulatedData.map(row =>
        columns.map(col => {
          let val = row[col] === null || row[col] === undefined ? '' : String(row[col]);
          if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
            val = `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        }).join(',')
      );
      const csvContent = [header, ...rows].join('\r\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `${filename}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (format === 'XLS') {
      // Create HTML table representation that Excel opens natively as XLS
      const headerHtml = `<tr>${columns.map(col => `<th style="background-color: #A31D1D; color: white; border: 1px solid #ddd; padding: 8px;">${col}</th>`).join('')}</tr>`;
      const rowsHtml = simulatedData.map(row =>
        `<tr>${columns.map(col => {
          const val = row[col] === null || row[col] === undefined ? '' : String(row[col]);
          return `<td style="border: 1px solid #ddd; padding: 8px; font-family: monospace;">${val}</td>`;
        }).join('')}</tr>`
      ).join('\r\n');

      const tableHtml = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>Simulated Data</x:Name>
                  <x:WorksheetOptions>
                    <x:DisplayGridlines/>
                  </x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
          <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
        </head>
        <body>
          <table style="border-collapse: collapse; border: 1px solid #ddd;">
            <thead>${headerHtml}</thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </body>
        </html>
      `;

      const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `${filename}.xls`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className={`flex-1 p-8 overflow-y-auto transition-colors duration-400 ${isDark ? 'bg-axis-burgundy-deep' : 'bg-axis-gray'}`}>
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex justify-between items-center">
          <h1 className={`text-3xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-axis-red'}`}>
            Code Output & DQ Insights
          </h1>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={fetchQuota}
              disabled={quotaLoading}
              className={`text-xs font-bold border border-gray-200 rounded-xl px-3 py-1 transition-colors ${isDark ? 'bg-axis-red/20 hover:bg-axis-red/30 text-white border-axis-red/30' : 'bg-red-50 hover:bg-red-100 text-axis-burgundy border-red-200'
                }`}
            >
              {quotaLoading ? 'Loading quota...' : 'View Models Quota'}
            </button>
            <button
              onClick={fetchRoleTokenConsumption}
              disabled={consumptionLoading}
              className={`px-4 py-1.5 text-xs font-bold rounded-xl border transition-all ${isDark
                ? 'bg-white/10 hover:bg-white/15 text-white border-white/10'
                : 'bg-white hover:bg-gray-50 text-axis-red border-gray-200'
                }`}
            >
              {consumptionLoading ? 'Loading consumption...' : 'Token Consumption'}
            </button>
            {code && (
              <span className={`px-3 py-1 text-xs font-medium rounded-full flex items-center gap-1 ${isDark
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                }`}>
                <CheckCircle2 className="w-3 h-3" /> Ready to deploy
              </span>
            )}
          </div>
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
        <div className="flex justify-end gap-3">
          {simulationData?.execution_explanation && (
            <button
              onClick={() => setIsExplanationOpen(true)}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 border ${isDark
                ? 'bg-axis-red/20 hover:bg-axis-red/30 text-white border-axis-red/30'
                : 'bg-red-50 hover:bg-red-100 text-axis-burgundy border-red-200'
                }`}
            >
              <Info className="w-4 h-4" />
              Execution Explanation
            </button>
          )}
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
        {
          simulatedData.length > 0 && (
            <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className={`flex items-center gap-2 font-semibold uppercase text-xs tracking-widest ${isDark ? 'text-axis-cream' : 'text-axis-burgundy'}`}>
                <Database className="w-4 h-4" /> Simulated Output Preview
              </div>

              {/* Controls Row */}
              <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
                <div className="flex flex-col sm:flex-row gap-3 flex-1">
                  {/* Search Bar */}
                  <div className="relative flex-1 max-w-sm">
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

                  {/* Smart Column Filter Bar */}
                  <div className="relative flex-1 max-w-sm">
                    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-white/40' : 'text-gray-400'}`} />
                    <input
                      type="text"
                      placeholder='Smart Filter e.g. {"loan_status":"Active"}'
                      value={smartFilterQuery}
                      onChange={(e) => setSmartFilterQuery(e.target.value)}
                      className={`w-full pl-9 pr-16 py-2 text-sm rounded-xl focus:outline-none focus:ring-2 transition-all ${isDark
                        ? 'bg-white/10 border border-white/10 text-white placeholder-white/30 focus:ring-axis-red/30'
                        : 'bg-white border border-gray-200 text-gray-700 placeholder-gray-400 focus:ring-axis-burgundy/20'
                        }`}
                    />
                    {smartFilterQuery.trim() && (() => {
                      try {
                        JSON.parse(smartFilterQuery);
                        return null;
                      } catch (e) {
                        return (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-red-500 animate-pulse">
                            Invalid JSON
                          </span>
                        );
                      }
                    })()}
                  </div>

                  {/* Reset Sort Button */}
                  {sortColumn && (
                    <button
                      onClick={() => {
                        setSortColumn(null);
                        setSortDirection(null);
                      }}
                      className={`px-4 py-2 text-sm rounded-xl font-semibold transition-all border shrink-0 ${isDark
                        ? 'bg-axis-red/20 border-axis-red/30 text-white hover:bg-axis-red/30'
                        : 'bg-red-50 border-red-200 text-axis-burgundy hover:bg-red-100'
                        }`}
                    >
                      Reset Sort ({sortColumn})
                    </button>
                  )}
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

              {/* Flex Container for Column Inspector and Export Options */}
              <div className="flex flex-col md:flex-row gap-4 items-stretch">
                {/* Inspect Column Detail Card */}
                {selectedColumn && columnDetailsMap[selectedColumn] && (
                  <div className={`flex-1 p-4 rounded-xl border transition-colors duration-400 ${isDark
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

                        {columnDetailsMap[selectedColumn].lineage && (
                          <div className="mt-4 pt-4 border-t border-dashed border-gray-200/50 dark:border-white/10 space-y-2">
                            <div className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                              Data Lineage
                            </div>
                            <div className="flex items-center gap-2 flex-wrap text-xs font-semibold">
                              <span className={`px-2 py-0.5 rounded font-mono ${isDark ? 'bg-white/5 text-axis-cream' : 'bg-gray-100 text-axis-burgundy'}`}>
                                {columnDetailsMap[selectedColumn].lineage.source_tables.join(', ')}
                              </span>
                              <span className="opacity-50">→</span>
                              <span className={`px-2 py-0.5 rounded font-mono ${isDark ? 'bg-white/5 text-axis-cream' : 'bg-gray-100 text-axis-burgundy'}`}>
                                {columnDetailsMap[selectedColumn].lineage.source_columns.join(', ')}
                              </span>
                            </div>
                            <p className={`text-xs italic leading-relaxed ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
                              {columnDetailsMap[selectedColumn].lineage.transformation}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Export As Options Card */}
                <div className={`w-full md:w-64 p-4 rounded-xl border flex flex-col justify-between transition-colors duration-400 ${isDark
                  ? 'bg-axis-burgundy-dark/30 border-white/5 text-white'
                  : 'bg-white border-gray-100 text-gray-700'
                  }`}>
                  <div>
                    <h4 className="font-bold text-sm flex items-center gap-1.5">
                      <Download className={`w-4 h-4 ${isDark ? 'text-axis-cream' : 'text-axis-red'}`} /> Export Data
                    </h4>
                    <p className={`text-xs mt-1 leading-relaxed ${isDark ? 'text-white/60' : 'text-gray-400'}`}>
                      Download the simulated preview table contents locally.
                    </p>
                  </div>
                  <div className="mt-4 flex flex-col gap-1.5">
                    <label className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-white/50' : 'text-gray-550'}`}>
                      Export As
                    </label>
                    <select
                      onChange={(e) => {
                        const format = e.target.value;
                        if (format) {
                          handleExport(format);
                          e.target.value = ""; // Reset selection
                        }
                      }}
                      className={`px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 cursor-pointer transition-all ${isDark
                        ? 'bg-white/10 border border-white/10 text-white focus:ring-axis-red/30'
                        : 'bg-white border border-gray-200 text-gray-700 focus:ring-axis-burgundy/20'
                        }`}
                    >
                      <option value="" className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>Select format...</option>
                      <option value="CSV" className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>CSV Format</option>
                      <option value="XLS" className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>Excel (XLS) Format</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Table Component */}
              <div className={`rounded-2xl overflow-hidden shadow-xl border ${isDark ? 'bg-axis-burgundy-dark/40 border-white/10' : 'bg-white border-gray-200'
                }`}>
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-sm text-left">
                    <thead className={`text-xs uppercase tracking-wider transition-colors duration-400 border-b ${isDark ? 'bg-black/20 text-white/50 border-white/10' : 'bg-gray-50 text-gray-500 border-gray-200'
                      }`}>
                      <tr>
                        {displayedColumns.map((col: string) => {
                          const isSorted = sortColumn === col;
                          return (
                            <th
                              key={col}
                              scope="col"
                              onClick={() => handleHeaderClick(col)}
                              className="px-6 py-3 font-semibold cursor-pointer select-none hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-200"
                            >
                              <div className="flex items-center gap-1.5">
                                <span>{col}</span>
                                {isSorted ? (
                                  sortDirection === 'asc' ? (
                                    <ArrowUp className="w-3.5 h-3.5 text-axis-red" />
                                  ) : (
                                    <ArrowDown className="w-3.5 h-3.5 text-axis-red" />
                                  )
                                ) : (
                                  <ArrowUpDown className="w-3.5 h-3.5 opacity-30 hover:opacity-100 transition-opacity" />
                                )}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className={`divide-y transition-colors duration-400 ${isDark ? 'divide-white/10 text-gray-200' : 'divide-gray-100 text-gray-700'
                      }`}>
                      {paginatedRecords.length === 0 ? (
                        <tr>
                          <td colSpan={displayedColumns.length} className="px-6 py-8 text-center italic opacity-50">
                            No matching records found.
                          </td>
                        </tr>
                      ) : (
                        paginatedRecords.map((row, index) => (
                          <tr key={index} className={`hover:bg-black/5 transition-colors duration-200`}>
                            {displayedColumns.map((col: string) => (
                              <td key={col} className="px-6 py-3.5 font-mono text-xs whitespace-nowrap">
                                {row[col] !== null && row[col] !== undefined ? String(row[col]) : <span className="opacity-30">null</span>}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className={`px-6 py-4 border-t text-xs font-semibold flex flex-col sm:flex-row items-center justify-between gap-4 ${isDark ? 'bg-black/20 border-white/10 text-white/60' : 'bg-gray-50 border-gray-100 text-gray-500'
                  }`}>
                  <span>
                    Showing {filteredRecords.length > 0 ? (currentPage - 1) * 10 + 1 : 0} to{' '}
                    {Math.min(currentPage * 10, filteredRecords.length)} of{' '}
                    <span className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{filteredRecords.length}</span>{' '}
                    matching records (Simulated pool: {simulatedData.length})
                  </span>

                  {totalPages > 1 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className={`p-1.5 rounded-lg border transition-all disabled:opacity-30 disabled:cursor-not-allowed ${isDark
                          ? 'border-white/10 bg-white/5 hover:bg-white/10 text-white'
                          : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                          }`}
                        title="Previous Page"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="min-w-[60px] text-center">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className={`p-1.5 rounded-lg border transition-all disabled:opacity-30 disabled:cursor-not-allowed ${isDark
                          ? 'border-white/10 bg-white/5 hover:bg-white/10 text-white'
                          : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                          }`}
                        title="Next Page"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )
        }

        {/* DQ Insights Section */}
        {
          simulatedData.length > 0 && (
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className={`flex items-center gap-2 font-semibold uppercase text-xs tracking-widest ${isDark ? 'text-axis-cream' : 'text-axis-red'}`}>
                  <Activity className="w-4 h-4" /> Data Quality Insights
                </div>
                {formData?.tables && formData.tables.length > 0 && (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                      Table:
                    </span>
                    <select
                      value={selectedDqTable}
                      onChange={(e) => setSelectedDqTable(e.target.value)}
                      className={`px-3 py-1.5 rounded-xl text-sm focus:outline-none focus:ring-2 cursor-pointer transition-all ${isDark
                        ? 'bg-white/10 border border-white/10 text-white focus:ring-axis-red/30'
                        : 'bg-white border border-gray-200 text-gray-700 focus:ring-axis-burgundy/20'
                        }`}
                    >
                      <option value="Output Table" className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>
                        Output Table
                      </option>
                      {formData.tables.map((table: string) => (
                        <option key={table} value={table} className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>
                          {table}
                        </option>
                      ))}
                    </select>

                    {availableDqColumns.length > 0 && (
                      <>
                        <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                          Column:
                        </span>
                        <select
                          value={selectedDqColumn}
                          onChange={(e) => setSelectedDqColumn(e.target.value)}
                          className={`px-3 py-1.5 rounded-xl text-sm focus:outline-none focus:ring-2 cursor-pointer transition-all ${isDark
                            ? 'bg-white/10 border border-white/10 text-white focus:ring-axis-red/30'
                            : 'bg-white border border-gray-200 text-gray-700 focus:ring-axis-burgundy/20'
                            }`}
                        >
                          {availableDqColumns.map((col) => (
                            <option key={col} value={col} className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>
                              {col}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Row Count', value: activeInsights?.row_count, icon: HashIcon },
                  { label: 'Null Values', value: activeInsights?.null_values, darkColor: 'text-red-400', lightColor: 'text-red-600' },
                  { label: 'Duplicate Rows', value: activeInsights?.duplicate_rows, darkColor: 'text-orange-400', lightColor: 'text-orange-600' },
                  { label: 'Distinct Values', value: activeInsights?.distinct_values, darkColor: 'text-emerald-400', lightColor: 'text-emerald-600' },
                  { label: 'Whitespace / Empty Strings', value: activeInsights?.empty_strings, darkColor: 'text-amber-400', lightColor: 'text-amber-600' },
                  { label: 'Minimum', value: activeInsights?.minimum },
                  { label: 'Maximum', value: activeInsights?.maximum },
                  { label: 'Average', value: activeInsights?.average },
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
          )
        }

        {/* GitHub Push Configuration Form */}
        {
          simulatedData.length > 0 && (
            <div className={`p-6 rounded-2xl border transition-colors duration-400 space-y-4 ${isDark
              ? 'bg-axis-burgundy-dark/40 border-white/10 text-white'
              : 'bg-white border-gray-200 text-gray-700'
              }`}>
              <h3 className="text-sm font-semibold uppercase tracking-wider">GitHub Push Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Pod Name */}
                <div className="flex flex-col gap-1.5">
                  <label className={`text-xs font-semibold ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
                    Pod Name
                  </label>
                  <select
                    value={podName}
                    onChange={(e) => setPodName(e.target.value)}
                    className={`px-3.5 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 cursor-pointer transition-all ${isDark
                      ? 'bg-white/10 border border-white/10 text-white focus:ring-axis-red/30'
                      : 'bg-white border border-gray-200 text-gray-700 focus:ring-axis-burgundy/20'
                      }`}
                  >
                    <option value="Personalisation" className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>Personalisation</option>
                    <option value="Data Science" className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>Data Science</option>
                    <option value="Deposit" className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>Deposit</option>
                  </select>
                </div>

                {/* Project Name */}
                <div className="flex flex-col gap-1.5">
                  <label className={`text-xs font-semibold ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
                    Project Name
                  </label>
                  <select
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className={`px-3.5 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 cursor-pointer transition-all ${isDark
                      ? 'bg-white/10 border border-white/10 text-white focus:ring-axis-red/30'
                      : 'bg-white border border-gray-200 text-gray-700 focus:ring-axis-burgundy/20'
                      }`}
                  >
                    <option value="sdlc-data-engineering" className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>sdlc-data-engineering</option>
                    <option value="sdlc-analytics-engineering" className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>sdlc-analytics-engineering</option>
                    <option value="sdlc-data-science" className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>sdlc-data-science</option>
                  </select>
                </div>

                {/* Data File Name */}
                <div className="flex flex-col gap-1.5">
                  <label className={`text-xs font-semibold ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
                    Data File Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. customer_auto_loans (.csv automatically added)"
                    value={dataFileName}
                    onChange={(e) => setDataFileName(e.target.value)}
                    className={`px-3.5 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all ${isDark
                      ? 'bg-white/10 border border-white/10 text-white placeholder-white/30 focus:ring-axis-red/30'
                      : 'bg-white border border-gray-200 text-gray-700 placeholder-gray-400 focus:ring-axis-burgundy/20'
                      }`}
                  />
                </div>

                {/* Query File Name */}
                <div className="flex flex-col gap-1.5">
                  <label className={`text-xs font-semibold ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
                    Query File Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. select_active_loans (extension automatically added)"
                    value={queryFileName}
                    onChange={(e) => setQueryFileName(e.target.value)}
                    className={`px-3.5 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all ${isDark
                      ? 'bg-white/10 border border-white/10 text-white placeholder-white/30 focus:ring-axis-red/30'
                      : 'bg-white border border-gray-200 text-gray-700 placeholder-gray-400 focus:ring-axis-burgundy/20'
                      }`}
                  />
                </div>
              </div>
            </div>
          )
        }

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
      </div >

      {/* Execution Explanation Modal */}
      {
        isExplanationOpen && simulationData?.execution_explanation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className={`w-full max-w-2xl rounded-2xl shadow-2xl border flex flex-col max-h-[85vh] transition-colors duration-400 ${isDark
              ? 'bg-axis-burgundy-deep border-white/10 text-white'
              : 'bg-white border-gray-200 text-gray-800'
              }`}>

              {/* Header */}
              <div className="px-6 py-4 border-b flex items-center justify-between border-dashed border-gray-200/50 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <Activity className={`w-5 h-5 ${isDark ? 'text-axis-cream' : 'text-axis-burgundy'}`} />
                  <h3 className="font-bold text-lg tracking-tight">Execution Explanation</h3>
                </div>
                <button
                  onClick={() => setIsExplanationOpen(false)}
                  className={`p-1.5 rounded-lg text-sm transition-all ${isDark ? 'hover:bg-white/10 text-white/60 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-800'}`}
                >
                  ✕
                </button>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto space-y-5 text-sm leading-relaxed">

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3">
                  <div className={`p-4 rounded-xl border ${isDark ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                    <div className="text-[10px] font-bold uppercase tracking-wider opacity-60">Time Elapsed</div>
                    <div className="text-xl font-bold mt-1 text-emerald-500">
                      {simulationData.execution_explanation.execution_time_ms} ms
                    </div>
                  </div>
                  <div className={`p-4 rounded-xl border ${isDark ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                    <div className="text-[10px] font-bold uppercase tracking-wider opacity-60">Records Processed</div>
                    <div className="text-xl font-bold mt-1">
                      {simulationData.execution_explanation.records_processed}
                    </div>
                  </div>
                  <div className={`p-4 rounded-xl border ${isDark ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                    <div className="text-[10px] font-bold uppercase tracking-wider opacity-60">Execution Cost</div>
                    <div className="text-sm font-semibold mt-1 leading-snug">
                      {simulationData.execution_explanation.execution_cost.includes("0.00") ? "FREE ($0.00)" : "EST. $0.0065"}
                    </div>
                  </div>
                </div>

                {/* Token Consumption */}
                <div className={`p-4 rounded-xl border flex flex-col gap-1 ${isDark ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                  <div className="text-[10px] font-bold uppercase tracking-wider opacity-60">LLM Token Consumption</div>
                  <div className="flex flex-wrap items-center justify-between gap-4 mt-1">
                    <div>
                      <span className="text-lg font-bold text-axis-red isDark:text-axis-cream">
                        {((generationTokens?.prompt_tokens || 0) + (simulationData.execution_explanation.prompt_tokens || 0) +
                          (generationTokens?.completion_tokens || 0) + (simulationData.execution_explanation.completion_tokens || 0)).toLocaleString()}
                      </span>
                      <span className="text-sm ml-1 opacity-60">total tokens used</span>
                    </div>
                    <div className="flex gap-4 text-sm">
                      <div>
                        <span className="font-semibold">Input:</span>{' '}
                        <span className="opacity-80">
                          {((generationTokens?.prompt_tokens || 0) + (simulationData.execution_explanation.prompt_tokens || 0)).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold">Generation:</span>{' '}
                        <span className="opacity-80">
                          {((generationTokens?.completion_tokens || 0) + (simulationData.execution_explanation.completion_tokens || 0)).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] opacity-40 mt-1 flex justify-between">
                    <span>Code Gen Phase: {((generationTokens?.prompt_tokens || 0) + (generationTokens?.completion_tokens || 0)).toLocaleString()} tkn</span>
                    <span>Simulation Phase: {((simulationData.execution_explanation.prompt_tokens || 0) + (simulationData.execution_explanation.completion_tokens || 0)).toLocaleString()} tkn</span>
                  </div>
                </div>

                {/* Query Executed */}
                <div className="space-y-1.5">
                  <div className="font-bold text-xs uppercase tracking-wider opacity-70">Executed Query / Code</div>
                  <div className={`p-4 rounded-xl font-mono text-xs overflow-x-auto max-h-40 border ${isDark
                    ? 'bg-black/40 border-white/5 text-gray-300'
                    : 'bg-gray-50 border-gray-200 text-gray-700'
                    }`}>
                    <pre><code>{simulationData.execution_explanation.query}</code></pre>
                  </div>
                </div>

                {/* Software Requirements */}
                <div className="space-y-1.5">
                  <div className="font-bold text-sm uppercase tracking-wider opacity-70">Required Libraries & Packages</div>
                  <div className="flex flex-wrap gap-2">
                    {simulationData.execution_explanation.software_requirements.map((req: string, idx: number) => (
                      <span key={idx} className={`text-sm px-2.5 py-1 rounded-lg border font-medium ${isDark
                        ? 'bg-white/5 border-white/10 text-gray-200'
                        : 'bg-gray-100 border-gray-200 text-gray-700'
                        }`}>
                        {req}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Steps to Execute */}
                <div className="space-y-1.5">
                  <div className="font-bold text-sm uppercase tracking-wider opacity-70">Steps to Run Code</div>
                  <ul className="space-y-1.5 pl-1">
                    {simulationData.execution_explanation.execution_steps.map((step: string, idx: number) => (
                      <li key={idx} className="flex gap-2.5 items-start">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${isDark ? 'bg-white/10 text-white' : 'bg-gray-200 text-gray-700'}`}>
                          {idx + 1}
                        </span>
                        <span className={`text-sm ${isDark ? 'text-white/80' : 'text-gray-600'}`}>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Special Instructions */}
                {simulationData.execution_explanation.special_instructions && (
                  <div className={`p-4 rounded-xl border flex items-start gap-3 ${isDark
                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                    }`}>
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-sm uppercase tracking-wider">Special Instructions</div>
                      <p className="text-sm mt-1 leading-relaxed">{simulationData.execution_explanation.special_instructions}</p>
                    </div>
                  </div>
                )}

                {/* Cost Detail (verbose) */}
                <div className={`p-4 rounded-xl border flex items-start gap-3 ${isDark
                  ? 'bg-white/5 border-white/5 text-white/70'
                  : 'bg-gray-50 border-gray-100 text-gray-500'
                  }`}>
                  <div className="text-sm">
                    <span className="font-bold uppercase tracking-wider text-[10px] block opacity-60 mb-0.5">Billing & Cost Analysis</span>
                    {simulationData.execution_explanation.execution_cost}
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t flex justify-end border-dashed border-gray-200/50 dark:border-white/10">
                <button
                  onClick={() => setIsExplanationOpen(false)}
                  className={`px-5 py-2 rounded-xl text-sm font-semibold shadow transition-all ${isDark
                    ? 'bg-white/10 hover:bg-white/15 text-white'
                    : 'bg-gray-900 hover:bg-gray-800 text-white'
                    }`}
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        )
      }

      {/* Role Token Consumption Modal */}
      {
        isConsumptionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className={`w-full max-w-2xl rounded-2xl p-6 shadow-2xl relative border ${isDark ? 'bg-axis-burgundy-dark text-white border-white/10' : 'bg-white text-gray-800 border-gray-200'
              }`}>
              <button
                onClick={() => setIsConsumptionModalOpen(false)}
                className={`absolute top-4 right-4 p-1.5 rounded-lg hover:bg-black/10 transition-colors ${isDark ? 'text-white/60 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className={`text-lg font-bold flex items-center gap-2 mb-2 ${isDark ? 'text-axis-cream' : 'text-axis-burgundy'}`}>
                <Activity className="w-5 h-5" /> Role Token Consumption
              </h3>
              <p className={`text-xs mb-4 ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
                Actual token usage details logged for the <strong>{user?.role}</strong> role.
              </p>

              <div className={`rounded-xl overflow-hidden border max-h-[300px] overflow-y-auto ${isDark ? 'border-white/10 bg-black/20' : 'border-gray-200 bg-white'
                }`}>
                {consumptionLoading ? (
                  <div className="p-8 text-center text-sm italic opacity-50">Loading logs...</div>
                ) : consumptionData.length === 0 ? (
                  <div className="p-8 text-center text-sm italic opacity-50">No records found</div>
                ) : (
                  <table className="w-full text-xs text-left">
                    <thead className={`uppercase border-b ${isDark ? 'bg-white/5 border-white/10 text-white/50' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                      <tr>
                        <th className="px-4 py-2">User ID</th>
                        <th className="px-4 py-2">Role</th>
                        <th className="px-4 py-2">Timestamp</th>
                        <th className="px-4 py-2 text-right">Tokens Consumed</th>
                        <th className="px-4 py-2 text-right">Cost (USD)</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? 'divide-white/10 text-gray-200' : 'divide-gray-150 text-gray-700'}`}>
                      {consumptionData.map((log, idx) => (
                        <tr key={idx} className="hover:bg-black/5">
                          <td className="px-4 py-2.5 font-mono">{log.userId}</td>
                          <td className="px-4 py-2.5">{log.role}</td>
                          <td className="px-4 py-2.5 font-mono">{log.timestamp}</td>
                          <td className="px-4 py-2.5 font-mono text-right">{log.tokens_consumed.toLocaleString()}</td>
                          <td className="px-4 py-2.5 font-mono text-right text-emerald-500">${log.cost.toFixed(6)}</td>
                        </tr>
                      ))}
                      {consumptionData.length > 0 && (() => {
                        const totalTokens = consumptionData.reduce((sum, log) => sum + (log.tokens_consumed || 0), 0);
                        const totalCost = consumptionData.reduce((sum, log) => sum + (log.cost || 0), 0);
                        return (
                          <tr className={`font-bold border-t-2 ${isDark ? 'bg-white/5 border-white/20' : 'bg-gray-100 border-gray-300'}`}>
                            <td className="px-4 py-3" colSpan={3}>Total</td>
                            <td className="px-4 py-3 font-mono text-right">{totalTokens.toLocaleString()}</td>
                            <td className="px-4 py-3 font-mono text-right text-emerald-500">${totalCost.toFixed(6)}</td>
                          </tr>
                        );
                      })()}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )
      }

      {/* Quota Details Modal */}
      {
        isQuotaModalOpen && quotaData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className={`w-full max-w-lg rounded-2xl p-6 shadow-2xl relative border ${isDark ? 'bg-axis-burgundy-dark text-white border-white/10' : 'bg-white text-gray-800 border-gray-200'
              }`}>
              <button
                type="button"
                onClick={() => setIsQuotaModalOpen(false)}
                className={`absolute top-4 right-4 p-1.5 rounded-lg hover:bg-black/10 transition-colors ${isDark ? 'text-white/60 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className={`text-lg font-bold flex items-center gap-2 mb-2 ${isDark ? 'text-axis-cream' : 'text-axis-burgundy'}`}>
                <Cpu className="w-5 h-5" /> Available LLM Quota
              </h3>
              <p className={`text-xs mb-4 ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
                Quota limits and consumption for <strong>{quotaData.role}</strong> role.
              </p>

              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {Object.keys(quotaData.limits || {}).map(modelName => {
                  const limit = quotaData.limits[modelName];
                  const used = limit?.used_tokens ?? 0;
                  const total = limit?.total_tokens ?? 1000000;
                  const remaining = Math.max(0, total - used);
                  const percent = Math.min(100, Math.round((used / total) * 100));

                  return (
                    <div key={modelName} className="space-y-1.5 text-left">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="font-mono">{modelName}</span>
                        <span className={isDark ? 'text-white/70' : 'text-gray-600'}>
                          {used.toLocaleString()} / {total.toLocaleString()} tokens ({percent}%)
                        </span>
                      </div>
                      {/* Progress Bar */}
                      <div className={`h-2.5 w-full rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-gray-100'}`}>
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${percent > 90 ? 'bg-red-500' : percent > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <div className="text-[10px] opacity-60 flex justify-between">
                        <span>Remaining: {remaining.toLocaleString()} tokens</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className={`mt-6 pt-4 border-t flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs font-semibold ${isDark ? 'border-white/10 text-white/85' : 'border-gray-100 text-gray-600'
                }`}>
                <div className="flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-emerald-500" />
                  <span>Remaining Balance: <span className="text-emerald-500">${quotaData.remaining_balance_usd.toFixed(2)}</span></span>
                </div>
                <div className="opacity-70">
                  Resets: {new Date(quotaData.reset_date).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

const HashIcon = () => <span className="text-xs text-gray-500">#</span>;

export default MainSection;
