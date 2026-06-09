import React from 'react';
import { Terminal, Activity, Rocket, GitBranch, CheckCircle2, Search, Info, Database, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Download, Save, X, Cpu, Coins, Moon, Sun } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import axios from 'axios';
//import MultiSelect from './MultiSelect';
import CustomDropdown from './CustomDropdown';

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
  flowExplanation?: string | null;
  insights: DQInsights | null;
  isLoading: boolean;
  apiBaseUrl: string;
  formData: any | null;
  generationTokens: { prompt_tokens: number; completion_tokens: number } | null;
  user?: { userId: string; role: string; canView: string; domain: string[] } | null;
  activeTab: 'sdlc' | 'cbi';
}

const MainSection: React.FC<MainSectionProps> = ({
  code,
  flowExplanation,
  insights,
  isLoading,
  apiBaseUrl,
  formData,
  generationTokens,
  user,
  activeTab
}) => {
  const { isDark, toggleTheme } = useTheme();

  // Shared States
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
  const [showCode, setShowCode] = React.useState(false);

  // Consumption Logs States
  const [isConsumptionModalOpen, setIsConsumptionModalOpen] = React.useState(false);
  const [consumptionData, setConsumptionData] = React.useState<any[]>([]);
  const [consumptionLoading, setConsumptionLoading] = React.useState(false);
  const [consumptionSearchQuery, setConsumptionSearchQuery] = React.useState('');
  const [consumptionSortColumn, setConsumptionSortColumn] = React.useState<string | null>(null);
  const [consumptionSortDirection, setConsumptionSortDirection] = React.useState<'asc' | 'desc' | null>(null);
  const [consumptionCurrentPage, setConsumptionCurrentPage] = React.useState(1);

  // Model Quotas Modal States
  const [isQuotaModalOpen, setIsQuotaModalOpen] = React.useState(false);
  const [quotaData, setQuotaData] = React.useState<any>(null);
  const [quotaLoading, setQuotaLoading] = React.useState(false);

  // GitHub Push Settings States
  const [podName, setPodName] = React.useState('Personalisation');
  const [projectName, setProjectName] = React.useState('sdlc-data-engineering');
  const [dataFileName, setDataFileName] = React.useState('');
  const [queryFileName, setQueryFileName] = React.useState('');

  // CBI Visualization States
  const [chartType, setChartType] = React.useState<string>('Bar Chart');
  const [selectedParams, setSelectedParams] = React.useState<string[]>([]);
  const [subsetSize, setSubsetSize] = React.useState<number>(10);

  React.useEffect(() => {
    setConsumptionCurrentPage(1);
  }, [consumptionSearchQuery, consumptionSortColumn, consumptionSortDirection]);

  React.useEffect(() => {
    setSimulatedData([]);
    setSimulationData(null);
    setOutputTableInsights(null);
    setTableInsightsMap({});
    setSelectedDqTable('Output Table');
    setSelectedDqColumn('');
    setColumnDetailsMap({});
    setSearchQuery('');
    setSmartFilterQuery('');
    setSortColumn(null);
    setSortDirection(null);
    setSelectedColumn('');
    setCurrentPage(1);
    setIsExplanationOpen(false);
    setSelectedParams([]);
    setSubsetSize(10);
  }, [activeTab]);

  // Fetch Token consumption Logs
  const fetchRoleTokenConsumption = async () => {
    if (!user) return;
    setConsumptionLoading(true);
    try {
      const response = await axios.get(`${apiBaseUrl}/role-token-consumption?role=${user.role}`);
      setConsumptionData(response.data);
      setConsumptionSearchQuery('');
      setConsumptionSortColumn(null);
      setConsumptionSortDirection(null);
      setConsumptionCurrentPage(1);
      setIsConsumptionModalOpen(true);
    } catch (err) {
      console.error('Failed to fetch role token consumption logs:', err);
      alert('Failed to retrieve role token consumption logs.');
    } finally {
      setConsumptionLoading(false);
    }
  };

  const handleConsumptionHeaderClick = (colName: string) => {
    if (consumptionSortColumn !== colName) {
      setConsumptionSortColumn(colName);
      setConsumptionSortDirection('asc');
    } else {
      if (consumptionSortDirection === 'asc') {
        setConsumptionSortDirection('desc');
      } else {
        setConsumptionSortDirection(null);
        setConsumptionSortColumn(null);
      }
    }
  };

  const filteredConsumptionData = React.useMemo(() => {
    let records = consumptionData;
    if (consumptionSearchQuery.trim()) {
      const query = consumptionSearchQuery.toLowerCase();
      records = records.filter(row => {
        return (
          (row.userId && String(row.userId).toLowerCase().includes(query)) ||
          (row.role && String(row.role).toLowerCase().includes(query)) ||
          (row.timestamp && String(row.timestamp).toLowerCase().includes(query)) ||
          (row.tokens_consumed !== undefined && String(row.tokens_consumed).toLowerCase().includes(query)) ||
          (row.cost !== undefined && String(row.cost).toLowerCase().includes(query))
        );
      });
    }

    if (consumptionSortColumn && consumptionSortDirection) {
      records = [...records].sort((a, b) => {
        const valA = a[consumptionSortColumn];
        const valB = b[consumptionSortColumn];

        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;

        const numA = Number(valA);
        const numB = Number(valB);
        if (!isNaN(numA) && !isNaN(numB)) {
          return consumptionSortDirection === 'asc' ? numA - numB : numB - numA;
        }

        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        return consumptionSortDirection === 'asc'
          ? strA.localeCompare(strB)
          : strB.localeCompare(strA);
      });
    }

    return records;
  }, [consumptionData, consumptionSearchQuery, consumptionSortColumn, consumptionSortDirection]);

  const consumptionTotalPages = Math.ceil(filteredConsumptionData.length / 10);
  const paginatedConsumptionData = React.useMemo(() => {
    const startIndex = (consumptionCurrentPage - 1) * 10;
    return filteredConsumptionData.slice(startIndex, startIndex + 10);
  }, [filteredConsumptionData, consumptionCurrentPage]);

  const handleExportConsumption = (format: string) => {
    if (filteredConsumptionData.length === 0) return;

    const columns = ['userId', 'role', 'timestamp', 'tokens_consumed', 'cost'];
    const friendlyHeaders = ['User ID', 'Role', 'Timestamp', 'Tokens Consumed', 'Cost (USD)'];
    const filename = `role_token_consumption_${user?.role || 'export'}_${new Date().toLocaleString()}`;

    if (format === 'CSV') {
      const header = friendlyHeaders.join(',');
      const rows = filteredConsumptionData.map(row =>
        columns.map(col => {
          let val = row[col] === null || row[col] === undefined ? '' : String(row[col]);
          if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
            val = `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        }).join(',')
      );
      const totalTokens = filteredConsumptionData.reduce((sum, log) => sum + (log.tokens_consumed || 0), 0);
      const totalCost = filteredConsumptionData.reduce((sum, log) => sum + (log.cost || 0), 0);
      const totalRow = ['Total', '', '', String(totalTokens), `$${totalCost.toFixed(6)}`].join(',');

      const csvContent = [header, ...rows, totalRow].join('\r\n');
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
      const headerHtml = `<tr>${friendlyHeaders.map(col => `<th style="background-color: #A31D1D; color: white; border: 1px solid #ddd; padding: 8px;">${col}</th>`).join('')}</tr>`;
      const rowsHtml = filteredConsumptionData.map(row =>
        `<tr>${columns.map(col => {
          const val = row[col] === null || row[col] === undefined ? '' : String(row[col]);
          return `<td style="border: 1px solid #ddd; padding: 8px; font-family: monospace;">${val}</td>`;
        }).join('')}</tr>`
      ).join('\r\n');

      const totalTokens = filteredConsumptionData.reduce((sum, log) => sum + (log.tokens_consumed || 0), 0);
      const totalCost = filteredConsumptionData.reduce((sum, log) => sum + (log.cost || 0), 0);
      const totalRowHtml = `
        <tr style="font-weight: bold; background-color: #f2f2f2;">
          <td colspan="3" style="border: 1px solid #ddd; padding: 8px;">Total</td>
          <td style="border: 1px solid #ddd; padding: 8px; font-family: monospace; text-align: right;">${totalTokens.toLocaleString()}</td>
          <td style="border: 1px solid #ddd; padding: 8px; font-family: monospace; text-align: right; color: green;">$${totalCost.toFixed(6)}</td>
        </tr>
      `;

      const tableHtml = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>Token Consumption</x:Name>
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
            <tbody>${rowsHtml}${totalRowHtml}</tbody>
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

  // Reset outputs on code/insights change
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

    // Reset CBI state
    setChartType('Bar Chart');
    setSelectedParams([]);
    console.log(outputTableInsights);
    console.log(tableInsightsMap);
    setPodName('Personalisation');
    setProjectName('sdlc-data-engineering');
    setDataFileName('');
    setQueryFileName('');
  }, [code, insights]);

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
    let records = simulatedData.filter(row => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return Object.values(row).some(val =>
        val !== null && val !== undefined && String(val).toLowerCase().includes(query)
      );
    });

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
      // Ignore invalid JSON
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

    if (sortColumn && sortDirection) {
      records = [...records].sort((a, b) => {
        const valA = a[sortColumn];
        const valB = b[sortColumn];

        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;

        const numA = Number(valA);
        const numB = Number(valB);
        if (!isNaN(numA) && !isNaN(numB)) {
          return sortDirection === 'asc' ? numA - numB : numB - numA;
        }

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
        dq_insights: simulationData?.dataframe,
        timestamp: new Date().toLocaleString()
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

  const handleExport = (format: string) => {
    if (simulatedData.length === 0) return;
    const columns = Object.keys(columnDetailsMap);
    if (columns.length === 0) return;
    const filename = `simulated_output_${new Date().toLocaleString()}`;

    if (format === 'CSV') {
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

  const handleDownloadSVG = () => {
    const svgEl = document.getElementById("visualization-svg");
    if (!svgEl) {
      alert("No visualization SVG found to download.");
      return;
    }
    const clonedSvg = svgEl.cloneNode(true) as SVGElement;
    clonedSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const svgData = new XMLSerializer().serializeToString(clonedSvg);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);
    const downloadLink = document.createElement("a");
    downloadLink.href = svgUrl;
    downloadLink.download = `${chartType.toLowerCase().replace(/\s+/g, "_")}_visualization_${(new Date()).toLocaleString()}.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(svgUrl);
  };

  const handleDownloadPNG = () => {
    const svgEl = document.getElementById("visualization-svg");
    if (!svgEl) {
      alert("No visualization SVG found to download.");
      return;
    }

    const clonedSvg = svgEl.cloneNode(true) as SVGElement;
    clonedSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    // Copy computed styles to cloned SVG to preserve styles like Tailwind fill/stroke color
    const copyStyles = (src: Element, dest: Element) => {
      const srcStyles = window.getComputedStyle(src);
      const props = ['fill', 'stroke', 'font-family', 'font-size', 'font-weight', 'stroke-width', 'opacity', 'stroke-dasharray'];
      props.forEach(prop => {
        const val = srcStyles.getPropertyValue(prop);
        if (val) {
          (dest as HTMLElement).style.setProperty(prop, val);
        }
      });
      for (let i = 0; i < src.children.length; i++) {
        copyStyles(src.children[i], dest.children[i]);
      }
    };
    copyStyles(svgEl, clonedSvg);

    const bbox = svgEl.getBoundingClientRect();
    const exportWidth = bbox.width || 1000;
    const exportHeight = bbox.height || 400;

    // Use a scale factor for high-resolution retina-like crispness
    const scale = 2;
    const canvasWidth = exportWidth * scale;
    const canvasHeight = exportHeight * scale;

    clonedSvg.setAttribute("width", String(exportWidth));
    clonedSvg.setAttribute("height", String(exportHeight));

    const svgData = new XMLSerializer().serializeToString(clonedSvg);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(scale, scale);

        // Fill background color matching parent container theme
        const parentStyle = window.getComputedStyle(svgEl.closest('.mt-4') || svgEl.parentElement || svgEl);
        const bgColor = parentStyle.backgroundColor;
        ctx.fillStyle = bgColor && bgColor !== 'rgba(0, 0, 0, 0)' ? bgColor : (isDark ? '#1a0d13' : '#f9fafb');
        ctx.fillRect(0, 0, exportWidth, exportHeight);

        // Draw SVG onto canvas
        ctx.drawImage(img, 0, 0, exportWidth, exportHeight);

        // Download as PNG
        const pngUrl = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.href = pngUrl;
        downloadLink.download = `${chartType.toLowerCase().replace(/\s+/g, "_")}_visualization_${(new Date()).toLocaleString()}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      }
      URL.revokeObjectURL(svgUrl);
    };
    img.onerror = (err) => {
      console.error("Failed to load SVG for PNG conversion:", err);
      alert("Error generating PNG image.");
      URL.revokeObjectURL(svgUrl);
    };
    img.src = svgUrl;
  };

  // SVG Chart rendering logic
  const renderVisualization = () => {
    if (selectedParams.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center p-12 text-sm italic opacity-50">
          Please select parameters to visualize.
        </div>
      );
    }

    let labelCol = "";
    let valueCols: string[] = [];

    for (const p of selectedParams) {
      const hasNonNumeric = simulatedData.some(row => {
        const val = row[p];
        return val !== null && val !== undefined && isNaN(Number(val));
      });
      if (hasNonNumeric && !labelCol) {
        labelCol = p;
      } else {
        valueCols.push(p);
      }
    }

    if (!labelCol && selectedParams.length > 0) {
      labelCol = selectedParams[0];
      valueCols = selectedParams.slice(1);
    }
    if (valueCols.length === 0 && selectedParams.length > 0) {
      labelCol = "index";
      valueCols = [selectedParams[0]];
    }

    //let chartData: { label: string; [key: string]: number }[] = [];
    let chartData: any[] = [];
    if (valueCols.length === 0 && labelCol && labelCol !== "index") {
      const counts: Record<string, number> = {};
      simulatedData.forEach(row => {
        const key = String(row[labelCol] || "null");
        counts[key] = (counts[key] || 0) + 1;
      });
      chartData = Object.keys(counts).map(key => ({
        label: key,
        "Count": counts[key]
      }));
      valueCols = ["Count"];
    } else {
      const subset = simulatedData.slice(0, subsetSize);
      chartData = subset.map((row, idx) => {
        const labelVal = labelCol === "index" ? `Row ${idx + 1}` : String(row[labelCol] ?? `Row ${idx + 1}`);
        const item: any = { label: labelVal };
        valueCols.forEach(col => {
          item[col] = Number(row[col]) || 0;
        });
        return item;
      });
    }

    const colors = ['#EB1165', '#A31D1D', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];
    const width = 1000;
    const height = chartType === "Bar Chart" ? Math.max(400, chartData.length * 24) : 400;

    if (chartType === "Pie Chart" || chartType === "Donut Chart") {
      const targetCol = valueCols[0];
      const pieData = chartData.map((item, idx) => ({
        label: item.label,
        value: item[targetCol] || 0,
        color: colors[idx % colors.length]
      })).filter(x => x.value > 0);

      const total = pieData.reduce((sum, item) => sum + item.value, 0);
      const isDonut = chartType === "Donut Chart";

      let currentAngle = 0;
      const cx = 200;
      const cy = 175;
      const r = 120;

      return (
        <div className="flex flex-col sm:flex-row items-center gap-8 p-4 justify-center">
          {total === 0 ? (
            <div className="text-sm italic opacity-50">No positive numeric data available to map.</div>
          ) : (
            <>
              <svg id="visualization-svg" width={400} height={height} viewBox={`0 0 400 ${height}`} className="overflow-visible select-none">
                <g>
                  {pieData.map((item, idx) => {
                    const angle = (item.value / total) * 360;
                    const radStart = ((currentAngle - 90) * Math.PI) / 180;
                    const radEnd = ((currentAngle + angle - 90) * Math.PI) / 180;

                    const x1 = cx + r * Math.cos(radStart);
                    const y1 = cy + r * Math.sin(radStart);
                    const x2 = cx + r * Math.cos(radEnd);
                    const y2 = cy + r * Math.sin(radEnd);

                    const largeArc = angle > 180 ? 1 : 0;
                    const pathData = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;

                    currentAngle += angle;

                    return (
                      <path
                        key={idx}
                        d={pathData}
                        fill={item.color}
                        stroke={isDark ? "#1a0d13" : "#ffffff"}
                        strokeWidth="2"
                        className="transition-transform duration-300 hover:scale-[1.03] origin-center cursor-pointer"
                        style={{ transformOrigin: `${cx}px ${cy}px` }}
                      >
                        <title>{`${item.label}: ${item.value.toLocaleString()} (${((item.value / total) * 100).toFixed(1)}%)`}</title>
                      </path>
                    );
                  })}
                  {isDonut && (
                    <circle cx={cx} cy={cy} r={r * 0.55} fill={isDark ? "#1a0d13" : "#ffffff"} />
                  )}
                </g>
              </svg>

              <div className="flex-1 max-h-[300px] overflow-y-auto space-y-2 pr-2 text-xs">
                <div className="font-bold border-b pb-1 mb-2">Legend: {targetCol}</div>
                {pieData.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="truncate max-w-[150px] font-medium" title={item.label}>{item.label}</span>
                    <span className="ml-auto font-mono font-bold">{item.value.toLocaleString()}</span>
                    <span className="opacity-50">({((item.value / total) * 100).toFixed(1)}%)</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      );
    }

    if (chartType === "Heat Maps") {
      const cellWidth = 100;
      const cellHeight = 35;
      const paddingLeft = 130;
      const paddingTop = 50;

      let maxCellVal = 1;
      chartData.forEach(row => {
        valueCols.forEach(col => {
          const val = row[col] || 0;
          if (val > maxCellVal) maxCellVal = val;
        });
      });

      return (
        <div className="p-4 overflow-x-auto select-none">
          <svg id="visualization-svg" width={paddingLeft + valueCols.length * cellWidth + 50} height={paddingTop + chartData.length * cellHeight + 65} className="overflow-visible mx-auto">
            {valueCols.map((col, cIdx) => (
              <text
                key={col}
                x={paddingLeft + cIdx * cellWidth + cellWidth / 2}
                y={paddingTop - 15}
                textAnchor="middle"
                className={`text-[10px] font-bold uppercase ${isDark ? 'fill-white/60' : 'fill-gray-500'}`}
              >
                {col.length > 12 ? `${col.slice(0, 10)}..` : col}
              </text>
            ))}

            {chartData.map((row, rIdx) => {
              const y = paddingTop + rIdx * cellHeight;
              return (
                <g key={rIdx}>
                  <text
                    x={paddingLeft - 15}
                    y={y + cellHeight / 2 + 4}
                    textAnchor="end"
                    className={`text-[11px] font-semibold truncate ${isDark ? 'fill-white/80' : 'fill-gray-700'}`}
                  >
                    {row.label.length > 18 ? `${row.label.slice(0, 15)}..` : row.label}
                  </text>

                  {valueCols.map((col, cIdx) => {
                    const val = row[col] || 0;
                    const ratio = Math.max(0.05, Math.min(1, val / maxCellVal));
                    const x = paddingLeft + cIdx * cellWidth;

                    return (
                      <g key={col}>
                        <rect
                          x={x}
                          y={y}
                          width={cellWidth - 2}
                          height={cellHeight - 2}
                          fill="#EB1165"
                          style={{ fillOpacity: ratio }}
                          rx="4"
                        />
                        <text
                          x={x + cellWidth / 2}
                          y={y + cellHeight / 2 + 4}
                          textAnchor="middle"
                          className="text-[10px] font-bold fill-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
                        >
                          {val.toLocaleString()}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })}

            {/* Y-axis Label (Row labels / records) */}
            <text
              transform={`rotate(-90, 25, ${paddingTop + (chartData.length * cellHeight) / 2})`}
              x={25}
              y={paddingTop + (chartData.length * cellHeight) / 2}
              textAnchor="middle"
              className={`text-xs font-bold ${isDark ? 'fill-white/60' : 'fill-gray-500'}`}
            >
              Visualizing {subsetSize} of the {simulatedData.length} records
            </text>

            {/* X-axis Label (Parameters) */}
            <text
              x={paddingLeft + (valueCols.length * cellWidth) / 2}
              y={paddingTop + chartData.length * cellHeight + 45}
              textAnchor="middle"
              className={`text-xs font-bold ${isDark ? 'fill-white/60' : 'fill-gray-500'}`}
            >
              Parameters: {valueCols.join(', ')}
            </text>
          </svg>
        </div>
      );
    }

    const paddingLeft = chartType === "Bar Chart" ? 140 : 90;
    const paddingRight = 40;
    const paddingTop = 40;
    const paddingBottom = chartType === "Bar Chart" ? 70 : 75;
    const plotWidth = width - paddingLeft - paddingRight;
    const plotHeight = height - paddingTop - paddingBottom;

    let maxVal = 1;
    chartData.forEach(row => {
      valueCols.forEach(col => {
        const val = row[col] || 0;
        if (val > maxVal) maxVal = val;
      });
    });
    maxVal = Math.ceil(maxVal * 1.05);

    const step = maxVal / 5;
    const ticks = [0, step, step * 2, step * 3, step * 4, step * 5];

    if (chartType === "Bar Chart") {
      const barSpacing = plotHeight / chartData.length;
      const barHeight = Math.max(5, (barSpacing * 0.6) / valueCols.length);

      return (
        <div className="p-4 overflow-y-auto max-h-[550px] custom-scrollbar">
          <svg id="visualization-svg" className="w-full h-auto overflow-visible select-none" viewBox={`0 0 ${width} ${height}`}>
            {ticks.map((t, idx) => {
              const x = paddingLeft + (t / maxVal) * plotWidth;
              return (
                <g key={idx}>
                  <line x1={x} y1={paddingTop} x2={x} y2={paddingTop + plotHeight} stroke={isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"} strokeDasharray="4 4" />
                  {/* Top Tick Label */}
                  <text x={x} y={paddingTop - 10} textAnchor="middle" className={`text-[10px] font-mono ${isDark ? 'fill-white/40' : 'fill-gray-400'}`}>
                    {t.toLocaleString()}
                  </text>
                  {/* Bottom Tick Label */}
                  <text x={x} y={paddingTop + plotHeight + 15} textAnchor="middle" className={`text-[10px] font-mono ${isDark ? 'fill-white/40' : 'fill-gray-400'}`}>
                    {t.toLocaleString()}
                  </text>
                </g>
              );
            })}

            {chartData.map((row, rIdx) => {
              const yRow = paddingTop + rIdx * barSpacing;
              return (
                <g key={rIdx}>
                  <text x={paddingLeft - 10} y={yRow + barSpacing / 2 + 4} textAnchor="end" className={`text-[10px] font-bold ${isDark ? 'fill-white/80' : 'fill-gray-600'}`}>
                    {row.label.length > 20 ? `${row.label.slice(0, 18)}..` : row.label}
                  </text>

                  {valueCols.map((col, cIdx) => {
                    const val = row[col] || 0;
                    const barWidth = (val / maxVal) * plotWidth;
                    const barY = yRow + (barSpacing * 0.2) + cIdx * barHeight;
                    const color = colors[cIdx % colors.length];

                    return (
                      <rect
                        key={col}
                        x={paddingLeft}
                        y={barY}
                        width={Math.max(1, barWidth)}
                        height={barHeight}
                        fill={color}
                        rx="2"
                        className="transition-all duration-350 hover:brightness-110"
                      >
                        <title>{`${row.label} - ${col}: ${val.toLocaleString()}`}</title>
                      </rect>
                    );
                  })}
                </g>
              );
            })}
            <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={paddingTop + plotHeight} stroke={isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)"} />

            {/* Y-axis Label (Row labels / records) */}
            <text
              transform={`rotate(-90, 25, ${paddingTop + plotHeight / 2})`}
              x={25}
              y={paddingTop + plotHeight / 2}
              textAnchor="middle"
              className={`text-xs font-bold ${isDark ? 'fill-white/60' : 'fill-gray-500'}`}
            >
              Visualizing {subsetSize} of the {simulatedData.length} records
            </text>

            {/* X-axis Label (Parameter name) */}
            <text
              x={paddingLeft + plotWidth / 2}
              y={paddingTop + plotHeight + 45}
              textAnchor="middle"
              className={`text-xs font-bold ${isDark ? 'fill-white/60' : 'fill-gray-500'}`}
            >
              {valueCols.join(', ')}
            </text>
          </svg>
        </div>
      );
    }

    const columnWidth = plotWidth / chartData.length;

    return (
      <div className="p-4">
        <svg id="visualization-svg" className="w-full h-auto overflow-visible select-none" viewBox={`0 0 ${width} ${height}`}>
          {ticks.map((t, idx) => {
            const y = paddingTop + plotHeight - (t / maxVal) * plotHeight;
            return (
              <g key={idx}>
                <line x1={paddingLeft} y1={y} x2={paddingLeft + plotWidth} y2={y} stroke={isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"} />
                <text x={paddingLeft - 10} y={y + 4} textAnchor="end" className={`text-[10px] font-mono ${isDark ? 'fill-white/40' : 'fill-gray-400'}`}>
                  {t.toLocaleString()}
                </text>
              </g>
            );
          })}

          {chartData.map((row, idx) => {
            const totalLabels = chartData.length;
            const labelInterval = Math.max(1, Math.ceil(totalLabels / 25)); // Skip labels if there are too many (limit to max ~25 labels)
            const shouldShowLabel = idx % labelInterval === 0;

            if (!shouldShowLabel) return null;

            const x = paddingLeft + idx * columnWidth + columnWidth / 2;
            return (
              <text
                key={idx}
                x={x}
                y={paddingTop + plotHeight + 18}
                textAnchor="middle"
                transform={`rotate(-25, ${x}, ${paddingTop + plotHeight + 18})`}
                className={`text-[9px] font-bold ${isDark ? 'fill-white/60' : 'fill-gray-500'}`}
              >
                {row.label.length > 12 ? `${row.label.slice(0, 10)}..` : row.label}
              </text>
            );
          })}

          {chartType === "Column Chart" && chartData.map((row, rIdx) => {
            const xRow = paddingLeft + rIdx * columnWidth;
            const barWidth = Math.max(4, (columnWidth * 0.6) / valueCols.length);

            return (
              <g key={rIdx}>
                {valueCols.map((col, cIdx) => {
                  const val = row[col] || 0;
                  const barHeight = (val / maxVal) * plotHeight;
                  const xBar = xRow + (columnWidth * 0.2) + cIdx * barWidth;
                  const color = colors[cIdx % colors.length];

                  return (
                    <rect
                      key={col}
                      x={xBar}
                      y={paddingTop + plotHeight - barHeight}
                      width={barWidth}
                      height={Math.max(1, barHeight)}
                      fill={color}
                      rx="2"
                      className="transition-all duration-350 hover:brightness-110"
                    >
                      <title>{`${row.label} - ${col}: ${val.toLocaleString()}`}</title>
                    </rect>
                  );
                })}
              </g>
            );
          })}

          {chartType === "Line Graph" && valueCols.map((col, cIdx) => {
            const color = colors[cIdx % colors.length];
            const points = chartData.map((row, rIdx) => {
              const val = row[col] || 0;
              const x = paddingLeft + rIdx * columnWidth + columnWidth / 2;
              const y = paddingTop + plotHeight - (val / maxVal) * plotHeight;
              return { x, y, val, label: row.label };
            });

            const pathD = points.reduce((acc, p, idx) =>
              idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`
              , "");

            return (
              <g key={col}>
                <path d={pathD} fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                {points.map((p, idx) => (
                  <circle
                    key={idx}
                    cx={p.x}
                    cy={p.y}
                    r="4.5"
                    fill={color}
                    stroke={isDark ? "#1a0d13" : "#ffffff"}
                    strokeWidth="2"
                    className="cursor-pointer transition-transform duration-200 hover:scale-150"
                  >
                    <title>{`${p.label} - ${col}: ${p.val.toLocaleString()}`}</title>
                  </circle>
                ))}
              </g>
            );
          })}

          {chartType === "Scatter Plots" && valueCols.map((col, cIdx) => {
            const color = colors[cIdx % colors.length];
            return (
              <g key={col}>
                {chartData.map((row, rIdx) => {
                  const val = row[col] || 0;
                  const x = paddingLeft + rIdx * columnWidth + columnWidth / 2;
                  const y = paddingTop + plotHeight - (val / maxVal) * plotHeight;

                  return (
                    <circle
                      key={rIdx}
                      cx={x}
                      cy={y}
                      r="6.5"
                      fill={color}
                      opacity="0.85"
                      className="cursor-pointer transition-transform duration-200 hover:scale-150"
                    >
                      <title>{`${row.label} - ${col}: ${val.toLocaleString()}`}</title>
                    </circle>
                  );
                })}
              </g>
            );
          })}
          <line x1={paddingLeft} y1={paddingTop + plotHeight} x2={paddingLeft + plotWidth} y2={paddingTop + plotHeight} stroke={isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)"} />

          {/* Y-axis Label (Parameter name) */}
          <text
            transform={`rotate(-90, 25, ${paddingTop + plotHeight / 2})`}
            x={25}
            y={paddingTop + plotHeight / 2}
            textAnchor="middle"
            className={`text-xs font-bold ${isDark ? 'fill-white/60' : 'fill-gray-500'}`}
          >
            {valueCols.join(', ')}
          </text>

          {/* X-axis Label (Row labels / records) */}
          <text
            x={paddingLeft + plotWidth / 2}
            y={paddingTop + plotHeight + 52}
            textAnchor="middle"
            className={`text-xs font-bold ${isDark ? 'fill-white/60' : 'fill-gray-500'}`}
          >
            Visualizing {subsetSize} of the {simulatedData.length} records
          </text>
        </svg>
      </div>
    );
  };

  return (
    <div className={`flex-1 p-8 overflow-y-auto transition-colors duration-400 ${isDark ? 'bg-axis-burgundy-deep' : 'bg-axis-gray'}`}>
      <div className="max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-300">

        {/* HEADER */}
        <header className="flex justify-between items-center">
          <h1 className={`text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-axis-red'}`}>
            {activeTab === 'sdlc' ? 'Code Output & DQ Insights' : 'Code Output & Query Flow'}
          </h1>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={fetchQuota}
              disabled={quotaLoading}
              className={`text-xs font-bold border border-gray-200 rounded-xl px-3 py-1 transition-colors ${isDark ? 'bg-axis-red/20 hover:bg-axis-red/30 text-white border-axis-red/30' : 'bg-red-50 hover:bg-red-100 text-axis-burgundy border-red-200'}`}
            >
              {quotaLoading ? 'Loading quota...' : 'View Models Quota'}
            </button>
            <button
              onClick={fetchRoleTokenConsumption}
              disabled={consumptionLoading}
              className={`px-4 py-1.5 text-xs font-bold rounded-xl border transition-all ${isDark
                ? 'bg-white/10 hover:bg-white/15 text-white border-white/10'
                : 'bg-white hover:bg-gray-50 text-axis-red border-gray-200'}`}
            >
              {consumptionLoading ? 'Loading consumption...' : 'Token Consumption'}
            </button>
            {code && (
              <span className={`px-3 py-1 text-xs font-medium rounded-full flex items-center gap-1 ${isDark
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'}`}>
                <CheckCircle2 className="w-3 h-3" /> Ready to deploy
              </span>
            )}

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              type="button"
              className={`relative w-14 h-7 rounded-full transition-all duration-400 flex items-center ${isDark
                ? 'bg-axis-burgundy-dark border border-axis-red/30 shadow-[0_0_12px_rgba(235,17,101,0.15)]'
                : 'bg-gray-200 border border-gray-300'}`}
              aria-label="Toggle dark mode"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <div
                className={`absolute w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300 ${isDark
                  ? 'translate-x-[30px] bg-axis-red shadow-lg shadow-axis-red/30'
                  : 'translate-x-1 bg-white shadow-md'}`}
              >
                {isDark ? (
                  <Moon className="w-3.5 h-3.5 text-white" />
                ) : (
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                )}
              </div>
            </button>
          </div>
        </header>

        {activeTab === 'sdlc' ? (
          // SDLC Assist Rendering Block
          <>
            {/* Generated Code Section */}
            <section className="space-y-4">
              <div className={`flex items-center gap-2 font-semibold uppercase text-xs tracking-widest ${isDark ? 'text-axis-cream' : 'text-axis-burgundy'}`}>
                <Terminal className="w-4 h-4" /> Generated Code
              </div>
              <div className={`rounded-2xl overflow-hidden shadow-xl relative transition-colors duration-400 border ${isDark
                ? 'bg-axis-burgundy-dark/60 border-white/10'
                : 'bg-white border-gray-200'}`}>
                <div className={`flex items-center gap-1.5 px-4 py-3 border-b transition-colors duration-400 ${isDark ? 'bg-black/20 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                </div>
                <pre className={`p-6 font-mono text-sm leading-relaxed whitespace-pre-wrap break-all overflow-x-auto min-h-[300px] ${isLoading ? 'animate-pulse-subtle' : ''}`}>
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

            {/* Run Code Button Row */}
            <div className="flex justify-end gap-3">
              {simulationData?.execution_explanation && (
                <button
                  onClick={() => setIsExplanationOpen(true)}
                  className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 border ${isDark
                    ? 'bg-axis-red/20 hover:bg-axis-red/30 text-white border-axis-red/30'
                    : 'bg-red-50 hover:bg-red-100 text-axis-burgundy border-red-200'}`}
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
                  : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200'}`}
              >
                {isSimulating ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Rocket className="w-4 h-4" />
                )}
                {isSimulating ? 'Simulating...' : 'Run Code'}
              </button>
            </div>

            {/* Simulated Output Preview Section */}
            {simulatedData.length > 0 && (
              <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className={`flex items-center gap-2 font-semibold uppercase text-xs tracking-widest ${isDark ? 'text-axis-cream' : 'text-axis-burgundy'}`}>
                  <Database className="w-4 h-4" /> Simulated Output Preview
                </div>

                {/* Controls Row */}
                <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
                  <div className="flex flex-col sm:flex-row gap-3 flex-1">
                    <div className="relative flex-1 max-w-sm">
                      <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-white/40' : 'text-gray-400'}`} />
                      <input
                        type="text"
                        placeholder="Search simulated records..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={`w-full pl-9 pr-4 py-2 text-sm rounded-xl focus:outline-none focus:ring-2 transition-all ${isDark
                          ? 'bg-white/10 border border-white/10 text-white placeholder-white/30 focus:ring-axis-red/30'
                          : 'bg-white border border-gray-200 text-gray-700 placeholder-gray-400 focus:ring-axis-burgundy/20'}`}
                      />
                    </div>

                    <div className="relative flex-1 max-w-sm">
                      <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-white/40' : 'text-gray-400'}`} />
                      <input
                        type="text"
                        placeholder='Smart Filter e.g. {"loan_status":"Active"}'
                        value={smartFilterQuery}
                        onChange={(e) => setSmartFilterQuery(e.target.value)}
                        className={`w-full pl-9 pr-16 py-2 text-sm rounded-xl focus:outline-none focus:ring-2 transition-all ${isDark
                          ? 'bg-white/10 border border-white/10 text-white placeholder-white/30 focus:ring-axis-red/30'
                          : 'bg-white border border-gray-200 text-gray-700 placeholder-gray-400 focus:ring-axis-burgundy/20'}`}
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

                    {sortColumn && (
                      <button
                        onClick={() => {
                          setSortColumn(null);
                          setSortDirection(null);
                        }}
                        className={`px-4 py-2 text-sm rounded-xl font-semibold transition-all border shrink-0 ${isDark
                          ? 'bg-axis-red/20 border-axis-red/30 text-white hover:bg-axis-red/30'
                          : 'bg-red-50 border-red-200 text-axis-burgundy hover:bg-red-100'}`}
                      >
                        Reset Sort ({sortColumn})
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-white/50' : 'text-gray-555'}`}>
                      Inspect Column:
                    </span>
                    <select
                      value={selectedColumn}
                      onChange={(e) => setSelectedColumn(e.target.value)}
                      className={`px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 cursor-pointer transition-all ${isDark
                        ? 'bg-white/10 border border-white/10 text-white focus:ring-axis-red/30'
                        : 'bg-white border border-gray-200 text-gray-700 focus:ring-axis-burgundy/20'}`}
                    >
                      {Object.keys(columnDetailsMap).map((col) => (
                        <option key={col} value={col} className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row gap-4 items-stretch">
                  {selectedColumn && columnDetailsMap[selectedColumn] && (
                    <div className={`flex-1 p-4 rounded-xl border transition-colors duration-400 ${isDark
                      ? 'bg-axis-burgundy-dark/30 border-white/5 text-white'
                      : 'bg-white border-gray-100 text-gray-700'}`}>
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
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${isDark ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-600'}`}>
                              Type: {columnDetailsMap[selectedColumn].data_type}
                            </span>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${isDark ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-600'}`}>
                              Role: {columnDetailsMap[selectedColumn].role}
                            </span>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${columnDetailsMap[selectedColumn].classification.toUpperCase() === 'PII' || columnDetailsMap[selectedColumn].classification.toUpperCase() === 'PRIVATE'
                              ? (isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-50 text-red-600')
                              : (isDark ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-600')}`}>
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

                  <div className={`w-full md:w-64 p-4 rounded-xl border flex flex-col justify-between transition-colors duration-400 ${isDark
                    ? 'bg-axis-burgundy-dark/30 border-white/5 text-white'
                    : 'bg-white border-gray-100 text-gray-700'}`}>
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
                            e.target.value = "";
                          }
                        }}
                        className={`px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 cursor-pointer transition-all ${isDark
                          ? 'bg-white/10 border border-white/10 text-white focus:ring-axis-red/30'
                          : 'bg-white border border-gray-200 text-gray-700 focus:ring-axis-burgundy/20'}`}
                      >
                        <option value="" className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>Select format...</option>
                        <option value="CSV" className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>CSV Format</option>
                        <option value="XLS" className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>Excel (XLS) Format</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Table Component */}
                <div className={`rounded-2xl overflow-hidden shadow-xl border ${isDark ? 'bg-axis-burgundy-dark/40 border-white/10' : 'bg-white border-gray-200'}`}>
                  <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-sm text-left">
                      <thead className={`text-xs uppercase tracking-wider transition-colors duration-400 border-b ${isDark ? 'bg-black/20 text-white/50 border-white/10' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
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
                      <tbody className={`divide-y transition-colors duration-400 ${isDark ? 'divide-white/10 text-gray-200' : 'divide-gray-100 text-gray-700'}`}>
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
                  <div className={`px-6 py-4 border-t text-xs font-semibold flex flex-col sm:flex-row items-center justify-between gap-4 ${isDark ? 'bg-black/20 border-white/10 text-white/60' : 'bg-gray-50 border-gray-100 text-gray-500'}`}>
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
                            : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'}`}
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
                            : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'}`}
                          title="Next Page"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* DQ Insights Section */}
            {simulatedData.length > 0 && (
              <section className="space-y-4 animate-in fade-in duration-300">
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
                          : 'bg-white border border-gray-200 text-gray-700 focus:ring-axis-burgundy/20'}`}
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
                              : 'bg-white border border-gray-200 text-gray-700 focus:ring-axis-burgundy/20'}`}
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
                    <div key={idx} className={`p-5 rounded-xl transition-colors group shadow-sm duration-400 border ${isDark
                      ? 'bg-axis-burgundy-dark/50 border-white/10 hover:border-axis-red/40 text-white'
                      : 'bg-white border border-gray-200 hover:border-axis-burgundy/30 text-gray-800'}`}>
                      <div className={`text-xs font-medium mb-1 ${isDark ? 'text-white/50' : 'text-gray-555'}`}>{item.label}</div>
                      <div className={`text-2xl font-bold group-hover:scale-105 transition-transform origin-left ${(isDark ? item.darkColor : item.lightColor) || (isDark ? 'text-white' : 'text-gray-905')}`}>
                        {isLoading ? '...' : (item.value ?? '-')}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          // Conversational BI Tab Rendering Block
          <>
            {/* side-by-side Code & Flow Explanation Section */}
            <div className="flex flex-col md:flex-row gap-6">

              {/* Flow Explanation Card */}
              <section className="flex-1 min-w-0 space-y-4">
                <div className={`flex items-center gap-2 p-2 font-semibold uppercase text-xs tracking-widest ${isDark ? 'text-axis-cream' : 'text-axis-burgundy'}`}>
                  <Info className="w-4 h-4" /> Query Flow
                </div>
                <div className={`rounded-2xl p-5 min-h-[300px] max-h-[390px] overflow-y-auto shadow-xl relative transition-all border leading-relaxed text-sm ${isDark
                  ? 'bg-axis-burgundy-dark/40 border-white/10 text-gray-200'
                  : 'bg-white border-gray-200 text-gray-600'}`}>
                  {isLoading ? (
                    <div className="space-y-3 animate-pulse">
                      <div className="h-4 bg-gray-300 dark:bg-white/10 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-300 dark:bg-white/10 rounded w-5/6"></div>
                      <div className="h-4 bg-gray-300 dark:bg-white/10 rounded w-2/3"></div>
                      <div className="h-4 bg-gray-300 dark:bg-white/10 rounded w-1/2"></div>
                    </div>
                  ) : flowExplanation ? (
                    <ol className="list-decimal pl-5 space-y-2 text-xs font-medium">
                      {flowExplanation
                        .split('.')
                        .map(s => s.trim())
                        .filter(Boolean)
                        .map((sentence, idx) => (
                          <li key={idx} className="leading-relaxed">
                            {sentence}.
                          </li>
                        ))}
                    </ol>
                  ) : (
                    <div className={`italic text-xs ${isDark ? 'text-white/30' : 'text-gray-400'}`}>
                      Explanation steps detailing the referred tables, columns, and datasets will display here...
                    </div>
                  )}
                </div>
              </section>

              {/* Code Output Card */}
              <section className="flex-1 min-w-0 space-y-4">
                <div className={`flex items-center gap-2 font-semibold uppercase text-xs tracking-widest ${isDark ? 'text-axis-cream' : 'text-axis-burgundy'}`}>
                  <Terminal className="w-4 h-4" />
                  <button className="rounded-xl p-2 text-sm font-semibold border border-axis-red/30" onClick={() => setShowCode(prev => !prev)}>{showCode ? 'Hide Code' : 'Show Code'}</button>
                </div>
                {showCode && <div className={`rounded-2xl overflow-hidden shadow-xl relative transition-colors duration-400 border ${isDark
                  ? 'bg-axis-burgundy-dark/60 border-white/10'
                  : 'bg-white border-gray-200'}`}>
                  <div className={`flex items-center gap-1.5 px-4 py-3 border-b transition-colors duration-400 ${isDark ? 'bg-black/20 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                  </div>
                  <pre className={`p-5 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all min-h-[260px] max-h-[350px] overflow-y-auto ${isLoading ? 'animate-pulse-subtle' : ''}`}>
                    <code className={isDark ? 'text-gray-200' : 'text-gray-700'}>
                      {isLoading ? (
                        <span className={isDark ? 'text-white/40' : 'text-gray-400'}>Generating SQL code snippet...</span>
                      ) : (
                        code || <span className={`italic ${isDark ? 'text-white/30' : 'text-gray-400'}`}>-- SQL query output will appear here...</span>
                      )}
                    </code>
                  </pre>
                </div>}
              </section>
            </div>

            {/* Run Code Button Row */}
            <div className="flex justify-end gap-3">
              {simulationData?.execution_explanation && (
                <button
                  onClick={() => setIsExplanationOpen(true)}
                  className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 border ${isDark
                    ? 'bg-axis-red/20 hover:bg-axis-red/30 text-white border-axis-red/30'
                    : 'bg-red-50 hover:bg-red-100 text-axis-burgundy border-red-200'}`}
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
                  : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200'}`}
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

                {/* Controls Row - ONLY Search and Export dropdown */}
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                  <div className="relative flex-1 w-full max-w-sm">
                    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-white/40' : 'text-gray-400'}`} />
                    <input
                      type="text"
                      placeholder="Search simulated records..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full pl-9 pr-4 py-2 text-sm rounded-xl focus:outline-none focus:ring-2 transition-all ${isDark
                        ? 'bg-white/10 border border-white/10 text-white placeholder-white/30 focus:ring-axis-red/30'
                        : 'bg-white border border-gray-200 text-gray-700 placeholder-gray-400 focus:ring-axis-burgundy/20'}`}
                    />
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                      Export As:
                    </span>
                    <select
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                          handleExport(val);
                          e.target.value = "";
                        }
                      }}
                      className={`px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 cursor-pointer transition-all ${isDark
                        ? 'bg-white/10 border border-white/10 text-white focus:ring-axis-red/30'
                        : 'bg-white border border-gray-200 text-gray-700 focus:ring-axis-burgundy/20'}`}
                    >
                      <option value="" className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>Select format...</option>
                      <option value="CSV" className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>CSV</option>
                      <option value="XLS" className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>Excel (XLS)</option>
                    </select>
                  </div>
                </div>

                {/* Table Component */}
                <div className={`rounded-2xl overflow-hidden shadow-xl border ${isDark ? 'bg-axis-burgundy-dark/40 border-white/10' : 'bg-white border-gray-200'}`}>
                  <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-sm text-left">
                      <thead className={`text-xs uppercase tracking-wider transition-colors duration-400 border-b ${isDark ? 'bg-black/20 text-white/50 border-white/10' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
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
                      <tbody className={`divide-y transition-colors duration-400 ${isDark ? 'divide-white/10 text-gray-200' : 'divide-gray-100 text-gray-700'}`}>
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
                  <div className={`px-6 py-4 border-t text-xs font-semibold flex flex-col sm:flex-row items-center justify-between gap-4 ${isDark ? 'bg-black/20 border-white/10 text-white/60' : 'bg-gray-50 border-gray-100 text-gray-500'}`}>
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
                            : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'}`}
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
                            : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'}`}
                          title="Next Page"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* DQ Insights Section */}
            {simulatedData.length > 0 && (
              <section className="space-y-4 animate-in fade-in duration-300">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className={`flex items-center gap-2 font-semibold uppercase text-xs tracking-widest ${isDark ? 'text-axis-cream' : 'text-axis-red'}`}>
                    <Activity className="w-4 h-4" /> Data Quality Insights
                  </div>
                  {formData?.tables && formData.tables.length > 0 && (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-white/50' : 'text-gray-550'}`}>
                        Table:
                      </span>
                      <select
                        value={selectedDqTable}
                        onChange={(e) => setSelectedDqTable(e.target.value)}
                        className={`px-3 py-1.5 rounded-xl text-sm focus:outline-none focus:ring-2 cursor-pointer transition-all ${isDark
                          ? 'bg-white/10 border border-white/10 text-white focus:ring-axis-red/30'
                          : 'bg-white border border-gray-200 text-gray-700 focus:ring-axis-burgundy/20'}`}
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
                              : 'bg-white border border-gray-200 text-gray-700 focus:ring-axis-burgundy/20'}`}
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
                    <div key={idx} className={`p-5 rounded-xl transition-colors group shadow-sm duration-400 border ${isDark
                      ? 'bg-axis-burgundy-dark/50 border-white/10 hover:border-axis-red/40 text-white'
                      : 'bg-white border border-gray-200 hover:border-axis-burgundy/30 text-gray-800'}`}>
                      <div className={`text-xs font-medium mb-1 ${isDark ? 'text-white/50' : 'text-gray-555'}`}>{item.label}</div>
                      <div className={`text-2xl font-bold group-hover:scale-105 transition-transform origin-left ${(isDark ? item.darkColor : item.lightColor) || (isDark ? 'text-white' : 'text-gray-905')}`}>
                        {isLoading ? '...' : (item.value ?? '-')}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* NEW Visualization Section */}
            {simulatedData.length > 0 && (
              <section className="space-y-4 p-6 rounded-2xl border transition-colors duration-400 shadow-sm animate-in fade-in duration-300 bg-white dark:bg-axis-burgundy-dark/40 border-gray-200 dark:border-white/10">
                <div className={`flex items-center gap-2 font-bold uppercase text-xs tracking-widest ${isDark ? 'text-axis-cream' : 'text-axis-burgundy'}`}>
                  <Activity className="w-4 h-4 text-axis-red" /> Visualization Panel
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Select Type Dropdown */}
                  <div className="flex flex-col gap-1.5">
                    <label className={`text-xs font-semibold ${isDark ? 'text-white/60' : 'text-gray-550'}`}>
                      Select Type
                    </label>
                    <select
                      value={chartType}
                      onChange={(e) => setChartType(e.target.value)}
                      className={`px-3.5 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 cursor-pointer transition-all ${isDark
                        ? 'bg-white/10 border border-white/10 text-white focus:ring-axis-red/30'
                        : 'bg-white border border-gray-200 text-gray-700 focus:ring-axis-burgundy/20'}`}
                    >
                      {["Bar Chart", "Column Chart", "Line Graph", "Pie Chart", "Donut Chart", "Heat Maps", "Scatter Plots"].map(type => (
                        <option key={type} value={type} className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Select Parameters Dropdown */}
                  <div className="relative">
                    <CustomDropdown
                      label="Select Parameter"
                      options={displayedColumns}
                      value={selectedParams[0] || 'Choose parameter...'}
                      onChange={(val) => {
                        setSelectedParams(val ? [val] : []);
                      }}
                    />
                  </div>

                  {/* Enter Visualization Subset Size */}
                  <div className="flex flex-col gap-1.5">
                    <label className={`text-xs font-semibold ${isDark ? 'text-white/60' : 'text-gray-550'}`}>
                      Enter Visualization Subset Size
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={simulatedData.length || 100}
                      value={subsetSize}
                      onChange={(e) => setSubsetSize(Math.max(1, parseInt(e.target.value) || 10))}
                      className={`px-3.5 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all ${isDark
                        ? 'bg-white/10 border border-white/10 text-white placeholder-white/30 focus:ring-axis-red/30'
                        : 'bg-white border border-gray-200 text-gray-700 placeholder-gray-400 focus:ring-axis-burgundy/20'}`}
                    />
                  </div>
                </div>

                {/* Visualization Output Render Box */}
                <div className={`mt-4 rounded-xl border p-4 transition-colors duration-400 ${isDark
                  ? 'bg-black/30 border-white/5 text-white'
                  : 'bg-gray-50 border-gray-150 text-gray-800'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-50 text-left">
                      Visualization Output: {chartType}
                    </span>
                    {selectedParams.length > 0 && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={handleDownloadSVG}
                          className={`p-1 rounded transition-colors ${isDark
                            ? 'hover:bg-white/10 text-gray-400 hover:text-white'
                            : 'hover:bg-black/5 text-gray-555 hover:text-gray-900'
                            }`}
                          title="Download as SVG"
                          aria-label="Download as SVG"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={handleDownloadPNG}
                          className={`p-1 rounded transition-colors ${isDark
                            ? 'hover:bg-white/10 text-gray-400 hover:text-white'
                            : 'hover:bg-black/5 text-gray-555 hover:text-gray-900'
                            }`}
                          title="Download as PNG"
                          aria-label="Download as PNG"
                        >
                          <Save className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  {renderVisualization()}
                </div>
              </section>
            )}
          </>
        )}

        {/* GitHub Push Configuration Form */}
        {simulatedData.length > 0 && activeTab === 'sdlc' && (
          <div className={`p-6 rounded-2xl border transition-colors duration-400 space-y-4 ${isDark
            ? 'bg-axis-burgundy-dark/40 border-white/10 text-white'
            : 'bg-white border-gray-200 text-gray-700'}`}>
            <h3 className="text-sm font-semibold uppercase tracking-wider">GitHub Push Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className={`text-xs font-semibold ${isDark ? 'text-white/60' : 'text-gray-550'}`}>
                  Pod Name
                </label>
                <select
                  value={podName}
                  onChange={(e) => setPodName(e.target.value)}
                  className={`px-3.5 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 cursor-pointer transition-all ${isDark
                    ? 'bg-white/10 border border-white/10 text-white focus:ring-axis-red/30'
                    : 'bg-white border border-gray-200 text-gray-700 focus:ring-axis-burgundy/20'}`}
                >
                  <option value="Personalisation" className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>Personalisation</option>
                  <option value="Data Science" className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>Data Science</option>
                  <option value="Deposit" className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>Deposit</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={`text-xs font-semibold ${isDark ? 'text-white/60' : 'text-gray-550'}`}>
                  Project Name
                </label>
                <select
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className={`px-3.5 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 cursor-pointer transition-all ${isDark
                    ? 'bg-white/10 border border-white/10 text-white focus:ring-axis-red/30'
                    : 'bg-white border border-gray-200 text-gray-700 focus:ring-axis-burgundy/20'}`}
                >
                  <option value="sdlc-data-engineering" className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>sdlc-data-engineering</option>
                  <option value="sdlc-analytics-engineering" className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>sdlc-analytics-engineering</option>
                  <option value="sdlc-data-science" className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>sdlc-data-science</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={`text-xs font-semibold ${isDark ? 'text-white/60' : 'text-gray-550'}`}>
                  Data File Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. customer_auto_loans (.csv automatically added)"
                  value={dataFileName}
                  onChange={(e) => setDataFileName(e.target.value)}
                  className={`px-3.5 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all ${isDark
                    ? 'bg-white/10 border border-white/10 text-white placeholder-white/30 focus:ring-axis-red/30'
                    : 'bg-white border border-gray-200 text-gray-700 placeholder-gray-400 focus:ring-axis-burgundy/20'}`}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={`text-xs font-semibold ${isDark ? 'text-white/60' : 'text-gray-550'}`}>
                  Query File Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. select_active_loans (extension automatically added)"
                  value={queryFileName}
                  onChange={(e) => setQueryFileName(e.target.value)}
                  className={`px-3.5 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all ${isDark
                    ? 'bg-white/10 border border-white/10 text-white placeholder-white/30 focus:ring-axis-red/30'
                    : 'bg-white border border-gray-200 text-gray-700 placeholder-gray-400 focus:ring-axis-burgundy/20'}`}
                />
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {simulatedData.length > 0 && activeTab === 'sdlc' && <div className={`flex items-center justify-end gap-4 pt-4 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
          <button
            onClick={handlePushToGitHub}
            disabled={isPushing || simulatedData.length === 0 || isLoading}
            className={`px-6 py-2.5 rounded-xl text-white text-sm font-semibold shadow-lg hover:brightness-110 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${isDark
              ? 'bg-axis-red shadow-axis-red/20'
              : 'bg-axis-burgundy shadow-axis-burgundy/20'}`}
          >
            {isPushing ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <GitBranch className="w-4 h-4" />
            )}
            {isPushing ? 'Pushing...' : 'Push to GitHub Repo'}
          </button>
        </div>}
      </div>

      {/* Execution Explanation Modal */}
      {isExplanationOpen && simulationData?.execution_explanation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-2xl rounded-2xl shadow-2xl border flex flex-col max-h-[85vh] transition-colors duration-400 ${isDark
            ? 'bg-axis-burgundy-deep border-white/10 text-white'
            : 'bg-white border-gray-200 text-gray-800'}`}>
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

            <div className="p-6 overflow-y-auto space-y-5 text-sm leading-relaxed">
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

              <div className="space-y-1.5">
                <div className="font-bold text-xs uppercase tracking-wider opacity-70">Executed Query / Code</div>
                <div className={`p-4 rounded-xl font-mono text-xs overflow-x-auto max-h-40 border ${isDark
                  ? 'bg-black/40 border-white/5 text-gray-300'
                  : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                  <pre><code>{simulationData.execution_explanation.query}</code></pre>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="font-bold text-sm uppercase tracking-wider opacity-70">Required Libraries & Packages</div>
                <div className="flex flex-wrap gap-2">
                  {simulationData.execution_explanation.software_requirements.map((req: string, idx: number) => (
                    <span key={idx} className={`text-sm px-2.5 py-1 rounded-lg border font-medium ${isDark
                      ? 'bg-white/5 border-white/10 text-gray-200'
                      : 'bg-gray-100 border-gray-200 text-gray-700'}`}>
                      {req}
                    </span>
                  ))}
                </div>
              </div>

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

              {simulationData.execution_explanation.special_instructions && (
                <div className={`p-4 rounded-xl border flex items-start gap-3 ${isDark
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                  : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-sm uppercase tracking-wider">Special Instructions</div>
                    <p className="text-sm mt-1 leading-relaxed">{simulationData.execution_explanation.special_instructions}</p>
                  </div>
                </div>
              )}

              <div className={`p-4 rounded-xl border flex items-start gap-3 ${isDark
                ? 'bg-white/5 border-white/5 text-white/70'
                : 'bg-gray-50 border-gray-100 text-gray-500'}`}>
                <div className="text-sm">
                  <span className="font-bold uppercase tracking-wider text-[10px] block opacity-60 mb-0.5">Billing & Cost Analysis</span>
                  {simulationData.execution_explanation.execution_cost}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t flex justify-end border-dashed border-gray-200/50 dark:border-white/10">
              <button
                onClick={() => setIsExplanationOpen(false)}
                className={`px-5 py-2 rounded-xl text-sm font-semibold shadow transition-all ${isDark
                  ? 'bg-white/10 hover:bg-white/15 text-white'
                  : 'bg-gray-900 hover:bg-gray-800 text-white'}`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Token Consumption Modal */}
      {isConsumptionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-3xl rounded-2xl p-6 shadow-2xl relative border ${isDark ? 'bg-axis-burgundy-dark text-white border-white/10' : 'bg-white text-gray-800 border-gray-200'}`}>
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

            {!consumptionLoading && consumptionData.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between mb-4">
                <div className="relative flex-1 w-full max-w-sm">
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-white/40' : 'text-gray-400'}`} />
                  <input
                    type="text"
                    placeholder="Search logs..."
                    value={consumptionSearchQuery}
                    onChange={(e) => setConsumptionSearchQuery(e.target.value)}
                    className={`w-full pl-9 pr-4 py-2 text-sm rounded-xl focus:outline-none focus:ring-2 transition-all ${isDark
                      ? 'bg-white/10 border border-white/10 text-white placeholder-white/30 focus:ring-axis-red/30'
                      : 'bg-white border border-gray-200 text-gray-700 placeholder-gray-400 focus:ring-axis-burgundy/20'}`}
                  />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                    Export:
                  </span>
                  <select
                    onChange={(e) => {
                      const format = e.target.value;
                      if (format) {
                        handleExportConsumption(format);
                        e.target.value = "";
                      }
                    }}
                    className={`px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 cursor-pointer transition-all ${isDark
                      ? 'bg-white/10 border border-white/10 text-white focus:ring-axis-red/30'
                      : 'bg-white border border-gray-200 text-gray-700 focus:ring-axis-burgundy/20'}`}
                  >
                    <option value="" className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>Select format...</option>
                    <option value="CSV" className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>CSV</option>
                    <option value="XLS" className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>Excel (XLS)</option>
                  </select>
                </div>
              </div>
            )}

            <div className={`rounded-xl overflow-hidden border max-h-[300px] overflow-y-auto ${isDark ? 'border-white/10 bg-black/20' : 'border-gray-200 bg-white'}`}>
              {consumptionLoading ? (
                <div className="p-8 text-center text-sm italic opacity-50">Loading logs...</div>
              ) : consumptionData.length === 0 ? (
                <div className="p-8 text-center text-sm italic opacity-50">No records found</div>
              ) : (
                <table className="w-full text-xs text-left">
                  <thead className={`uppercase border-b ${isDark ? 'bg-white/5 border-white/10 text-white/50' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                    <tr>
                      {[
                        { id: 'userId', label: 'User ID', align: 'left' },
                        { id: 'role', label: 'Role', align: 'left' },
                        { id: 'timestamp', label: 'Timestamp', align: 'left' },
                        { id: 'tokens_consumed', label: 'Tokens Consumed', align: 'right' },
                        { id: 'cost', label: 'Cost (USD)', align: 'right' },
                      ].map((col) => {
                        const isSorted = consumptionSortColumn === col.id;
                        return (
                          <th
                            key={col.id}
                            onClick={() => handleConsumptionHeaderClick(col.id)}
                            className={`px-4 py-2.5 font-semibold cursor-pointer select-none hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-200 ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                          >
                            <div className={`flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end' : 'justify-start'}`}>
                              <span>{col.label}</span>
                              {isSorted ? (
                                consumptionSortDirection === 'asc' ? (
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
                  <tbody className={`divide-y ${isDark ? 'divide-white/10 text-gray-200' : 'divide-gray-150 text-gray-700'}`}>
                    {paginatedConsumptionData.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center italic opacity-50">
                          No matching logs found
                        </td>
                      </tr>
                    ) : (
                      paginatedConsumptionData.map((log, idx) => (
                        <tr key={idx} className="hover:bg-black/5">
                          <td className="px-4 py-2.5 font-mono">{log.userId}</td>
                          <td className="px-4 py-2.5">{log.role}</td>
                          <td className="px-4 py-2.5 font-mono">{log.timestamp}</td>
                          <td className="px-4 py-2.5 font-mono text-right">{log.tokens_consumed.toLocaleString()}</td>
                          <td className="px-4 py-2.5 font-mono text-right text-emerald-500">${log.cost.toFixed(6)}</td>
                        </tr>
                      ))
                    )}
                    {filteredConsumptionData.length > 0 && (() => {
                      const totalTokens = filteredConsumptionData.reduce((sum, log) => sum + (log.tokens_consumed || 0), 0);
                      const totalCost = filteredConsumptionData.reduce((sum, log) => sum + (log.cost || 0), 0);
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

            {!consumptionLoading && consumptionTotalPages > 1 && (
              <div className={`px-4 py-3 mt-3 rounded-xl border text-xs font-semibold flex flex-col sm:flex-row items-center justify-between gap-4 ${isDark ? 'bg-black/10 border-white/10 text-white/60' : 'bg-gray-50 border-gray-100 text-gray-500'}`}>
                <span>
                  Showing {(consumptionCurrentPage - 1) * 10 + 1} to{' '}
                  {Math.min(consumptionCurrentPage * 10, filteredConsumptionData.length)} of{' '}
                  <span className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{filteredConsumptionData.length}</span>{' '}
                  matching logs (Total: {consumptionData.length})
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setConsumptionCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={consumptionCurrentPage === 1}
                    className={`p-1.5 rounded-lg border transition-all disabled:opacity-30 disabled:cursor-not-allowed ${isDark
                      ? 'border-white/10 bg-white/5 hover:bg-white/10 text-white'
                      : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'}`}
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="min-w-[60px] text-center">
                    Page {consumptionCurrentPage} of {consumptionTotalPages}
                  </span>
                  <button
                    onClick={() => setConsumptionCurrentPage(prev => Math.min(prev + 1, consumptionTotalPages))}
                    disabled={consumptionCurrentPage === consumptionTotalPages}
                    className={`p-1.5 rounded-lg border transition-all disabled:opacity-30 disabled:cursor-not-allowed ${isDark
                      ? 'border-white/10 bg-white/5 hover:bg-white/10 text-white'
                      : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'}`}
                    title="Next Page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quota Details Modal */}
      {isQuotaModalOpen && quotaData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-lg rounded-2xl p-6 shadow-2xl relative border ${isDark ? 'bg-axis-burgundy-dark text-white border-white/10' : 'bg-white text-gray-800 border-gray-200'}`}>
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
                const percent = Math.min(100, (used / total) * 100);

                return (
                  <div key={modelName} className="space-y-1.5 text-left">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="font-mono">{modelName}</span>
                      <span className={isDark ? 'text-white/70' : 'text-gray-600'}>
                        {used.toLocaleString()} / {total.toLocaleString()} tokens ({percent.toFixed(2)}%)
                      </span>
                    </div>
                    <div className={`h-2.5 w-full rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-gray-100'}`}>
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${percent > 90 ? 'bg-red-500' : percent > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
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

            <div className={`mt-6 pt-4 border-t flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs font-semibold ${isDark ? 'border-white/10 text-white/85' : 'border-gray-150 text-gray-600'}`}>
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
      )}
    </div>
  );
};

const HashIcon = () => <span className="text-xs text-gray-500">#</span>;

export default MainSection;
