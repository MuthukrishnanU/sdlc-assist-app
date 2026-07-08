import React from 'react';
import { Terminal, Activity, Rocket, GitBranch, CheckCircle2, Search, Info, Database, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Download, Save, X, Cpu, Coins, Moon, Sun, AlertCircle, CheckSquare, Copy, Check, Edit2, RefreshCw } from 'lucide-react';
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
  const [allTablesData, setAllTablesData] = React.useState<Record<string, any[]>>({});
  const [selectedPreviewTable, setSelectedPreviewTable] = React.useState<string>("Output Table");
  const [originalColumnDetailsMap, setOriginalColumnDetailsMap] = React.useState<Record<string, any>>({});
  const [searchQuery, setSearchQuery] = React.useState('');
  const [smartFilterQuery, setSmartFilterQuery] = React.useState('');
  const [sortColumn, setSortColumn] = React.useState<string | null>(null);
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc' | null>(null);
  const [editableCode, setEditableCode] = React.useState<string>('');
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [modalCodeValue, setModalCodeValue] = React.useState('');
  const [showLineage, setShowLineage] = React.useState(false);
  const [hoveredTargetCol, setHoveredTargetCol] = React.useState<string | null>(null);

  const [dqConfigParams, setDqConfigParams] = React.useState<any[]>([]);
  const [selectedDqParams, setSelectedDqParams] = React.useState<string[]>([]);
  const [isDqParamsDropdownOpen, setIsDqParamsDropdownOpen] = React.useState(false);
  const [calculatedDqMetrics, setCalculatedDqMetrics] = React.useState<Record<string, any>>({});
  const [isCalculatingDq, setIsCalculatingDq] = React.useState(false);

  const handleGenerateDqInsights = async () => {
    if (!selectedDqTable || !selectedDqColumn) {
      alert("Please select a table and column first.");
      return;
    }
    setIsCalculatingDq(true);
    try {
      const response = await axios.post(`${apiBaseUrl}/dq-insights/calculate`, {
        table_name: selectedDqTable,
        column_name: selectedDqColumn,
        metrics: selectedDqParams,
        all_tables_data: allTablesData
      });
      setCalculatedDqMetrics(response.data);
    } catch (err) {
      console.error("Failed to generate DQ Insights:", err);
      alert("Failed to generate DQ Insights.");
    } finally {
      setIsCalculatingDq(false);
    }
  };

  const [isRefreshingParams, setIsRefreshingParams] = React.useState(false);

  const fetchDqConfigParams = React.useCallback(async () => {
    setIsRefreshingParams(true);
    try {
      const response = await axios.get(`${apiBaseUrl}/dq-insights/parameters`);
      const active = response.data.filter((p: any) => p.status === 'Active');
      setDqConfigParams(active);
      const defaultKeys = ['row_count', 'null_values', 'distinct_values', 'duplicate_rows'];
      const availableDefaults = active.filter((p: any) => defaultKeys.includes(p.key)).map((p: any) => p.key);
      setSelectedDqParams(availableDefaults.length > 0 ? availableDefaults : active.slice(0, 4).map((p: any) => p.key));
    } catch (err) {
      console.error('Failed to load DQ parameters configuration:', err);
    } finally {
      setIsRefreshingParams(false);
    }
  }, [apiBaseUrl]);

  React.useEffect(() => {
    fetchDqConfigParams();
  }, [fetchDqConfigParams]);

  React.useEffect(() => {
    if (code) {
      setEditableCode(code);
    } else {
      setEditableCode('');
    }
  }, [code]);

  const handleOpenEditModal = () => {
    setModalCodeValue(editableCode);
    setIsEditModalOpen(true);
  };

  const handleUpdateCode = () => {
    setEditableCode(modalCodeValue);
    setIsEditModalOpen(false);
  };

  const [isSimulating, setIsSimulating] = React.useState(false);
  const [isPushing, setIsPushing] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [isExplanationOpen, setIsExplanationOpen] = React.useState(false);
  const [showCode, setShowCode] = React.useState(false);

  // Output Guardrails, Insights and Persona States
  const [outputGuardrailsStatus, setOutputGuardrailsStatus] = React.useState<{
    passed: boolean;
    checked: Array<{ name: string; status: string; message?: string }>;
  } | null>(null);
  const [isOutputGuardrailsModalOpen, setIsOutputGuardrailsModalOpen] = React.useState(false);
  const [insightsList, setInsightsList] = React.useState<string[]>([]);
  const [personasList, setPersonasList] = React.useState<any[]>([]);

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

  const [testCases, setTestCases] = React.useState<any[]>([]);
  const [isGeneratingTestCases, setIsGeneratingTestCases] = React.useState<boolean>(false);
  const [showTestCasesSection, setShowTestCasesSection] = React.useState<boolean>(false);
  const [runningTestCaseIndex, setRunningTestCaseIndex] = React.useState<number | null>(null);
  const [testCaseResults, setTestCaseResults] = React.useState<{ [key: number]: any }>({});
  const [isStoringCache, setIsStoringCache] = React.useState<boolean>(false);

  React.useEffect(() => {
    setTestCases([]);
    setShowTestCasesSection(false);
    setTestCaseResults({});
  }, [code, isLoading]);

  const [isCopied, setIsCopied] = React.useState(false);
  const [showToast, setShowToast] = React.useState(false);
  const copyTimeoutRef = React.useRef<any>(null);

  const handleCopyCode = () => {
    if (!editableCode) return;
    navigator.clipboard.writeText(editableCode).then(() => {
      setIsCopied(true);
      setShowToast(true);
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => {
        setIsCopied(false);
        setShowToast(false);
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };

  React.useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  // CBI Visualization States
  const [chartType, setChartType] = React.useState<string>('Bar Chart');
  const [xAxisParam, setXAxisParam] = React.useState<string>('');
  const [yAxisParam, setYAxisParam] = React.useState<string>('');
  const [subsetSize, setSubsetSize] = React.useState<number>(0);

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
    setCurrentPage(1);
    setAllTablesData({});
    setOriginalColumnDetailsMap({});
    setSelectedPreviewTable('Output Table');
    setShowLineage(false);
    setHoveredTargetCol(null);
    setIsExplanationOpen(false);
    setXAxisParam('');
    setYAxisParam('');
    setSubsetSize(0);
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
    setIsPushing(false);
    setCurrentPage(1);
    setAllTablesData({});
    setOriginalColumnDetailsMap({});
    setSelectedPreviewTable('Output Table');
    setShowLineage(false);
    setHoveredTargetCol(null);
    setOutputGuardrailsStatus(null);
    setIsOutputGuardrailsModalOpen(false);
    setInsightsList([]);
    setPersonasList([]);

    // Reset CBI state
    setChartType('Bar Chart');
    setXAxisParam('');
    setYAxisParam('');
    setSubsetSize(0);
    console.log(outputTableInsights);
    console.log(tableInsightsMap);
    setPodName('Personalisation');
    setProjectName('sdlc-data-engineering');
    setDataFileName('');
    setQueryFileName('');
  }, [code, insights]);

  React.useEffect(() => {
    setCalculatedDqMetrics({});
    const tableData = allTablesData[selectedDqTable] || [];
    if (tableData.length === 0) {
      setSelectedDqColumn('');
      return;
    }
    const cols = Object.keys(tableData[0] || {});
    const pk = simulationData?.primary_keys?.[selectedDqTable];
    if (pk && cols.includes(pk)) {
      setSelectedDqColumn(pk);
    } else if (cols.length > 0) {
      setSelectedDqColumn(cols[0]);
    } else {
      setSelectedDqColumn('');
    }
  }, [selectedDqTable, allTablesData, simulationData]);

  React.useEffect(() => {
    setCalculatedDqMetrics({});
  }, [selectedDqColumn]);

  const availableDqColumns = React.useMemo(() => {
    const tableData = allTablesData[selectedDqTable] || [];
    if (tableData.length === 0) return [];
    return Object.keys(tableData[0] || {});
  }, [selectedDqTable, allTablesData]);

  /* const activeInsights = React.useMemo(() => {
    if (!simulationData) return null;
    return simulationData.column_dq_insights?.[selectedDqTable]?.[selectedDqColumn] || null;
  }, [selectedDqTable, selectedDqColumn, simulationData]); */

  React.useEffect(() => {
    console.log(personasList);
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

  const handleExportLineage = () => {
    const svgEl = document.getElementById("lineage-svg") as unknown as SVGSVGElement | null;
    if (!svgEl) return;

    const clonedSvg = svgEl.cloneNode(true) as SVGElement;
    clonedSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    const copyStyles = (src: Element, dest: Element) => {
      const srcStyles = window.getComputedStyle(src);
      const props = ['fill', 'stroke', 'font-family', 'font-size', 'font-weight', 'stroke-width', 'opacity'];
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
    const exportHeight = bbox.height || 600;

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
        ctx.fillStyle = isDark ? '#1a0d13' : '#f9fafb';
        ctx.fillRect(0, 0, exportWidth, exportHeight);
        ctx.drawImage(img, 0, 0, exportWidth, exportHeight);

        const pngUrl = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.href = pngUrl;
        downloadLink.download = `data_lineage_${(new Date()).toLocaleString()}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      }
      URL.revokeObjectURL(svgUrl);
    };
    img.src = svgUrl;
  };

  const handleGenerateLineage = () => {
    setShowLineage(prev => !prev);
    if (!showLineage) {
      setTimeout(() => {
        const el = document.getElementById("lineage-svg");
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  };

  const lineageNodes = React.useMemo(() => {
    const targets = Object.keys(columnDetailsMap);
    const uniqueSources: string[] = [];

    targets.forEach(tgt => {
      const lin = columnDetailsMap[tgt]?.lineage;
      if (lin) {
        const srcTables = lin.source_tables || [];
        const srcCols = lin.source_columns || [];
        srcCols.forEach((col: string, idx: number) => {
          const tbl = srcTables[idx] || srcTables[0] || 'Unknown Table';
          const key = `${tbl}.${col}`;
          if (!uniqueSources.includes(key)) {
            uniqueSources.push(key);
          }
        });
      }
    });

    return { targets, uniqueSources };
  }, [columnDetailsMap]);

  const getColumnDetailsForTable = (tableName: string, cols: string[]) => {
    const details: Record<string, any> = {};
    cols.forEach(col => {
      if (originalColumnDetailsMap && originalColumnDetailsMap[col]) {
        details[col] = originalColumnDetailsMap[col];
      } else {
        details[col] = {
          friendly_name: col.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          description: `Attribute representing '${col}' in ${tableName}.`,
          data_type: 'string',
          role: col.includes('id') || col.includes('key') ? 'identifier' : 'dimension',
          classification: 'public',
          lineage: null
        };
      }
    });
    return details;
  };

  React.useEffect(() => {
    if (!allTablesData || Object.keys(allTablesData).length === 0) return;
    const data = allTablesData[selectedPreviewTable] || [];
    setSimulatedData(data);

    const cols = data.length > 0 ? Object.keys(data[0]) : [];
    const newDetails = getColumnDetailsForTable(selectedPreviewTable, cols);
    setColumnDetailsMap(newDetails);
  }, [selectedPreviewTable, allTablesData, originalColumnDetailsMap]);

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
    if (!editableCode || !formData) return;
    setIsSimulating(true);
    setShowLineage(false);
    setHoveredTargetCol(null);
    setCalculatedDqMetrics({});
    try {
      const response = await axios.post(`${apiBaseUrl}/simulate`, {
        tables: formData.tables,
        columns: formData.columns,
        sample_data_size: formData.sample_data_size,
        logic: formData.logic,
        generated_code: editableCode,
        format: formData.format,
        model: formData.model,
        role: user?.role,
        userId: user?.userId,
        active_tab: activeTab
      });
      setSimulationData(response.data);
      const df = response.data.dataframe || [];
      setSimulatedData(df);
      if (df.length < 10) {
        setSubsetSize(df.length);
      } else {
        setSubsetSize(10);
      }
      setColumnDetailsMap(response.data.column_details);
      setOriginalColumnDetailsMap(response.data.column_details || {});
      setAllTablesData(response.data.all_tables_data || { "Output Table": df });
      setSelectedPreviewTable("Output Table");
      setOutputTableInsights(response.data.dq_insights);
      if (response.data.table_dq_insights) {
        setTableInsightsMap(response.data.table_dq_insights);
      }


      // Store Output Guardrails, Insights, and Personas
      const ogList = response.data.output_guardrails || [];
      const ogPassed = ogList.length > 0 ? ogList.every((g: any) => g.status === 'Passed') : true;
      setOutputGuardrailsStatus({
        passed: ogPassed,
        checked: ogList
      });
      setInsightsList(response.data.insights || []);
      setPersonasList(response.data.personas || []);
    } catch (err) {
      console.error('Failed to run code simulation:', err);
      let tempErrMsg = 'Failed to simulate output. Make sure MongoDB database is seeded and backend is running.';
      if (!!err && !!err.response && !!err.response.data && !!err.response.data.detail) {
        tempErrMsg = err.response.data.detail;
      }
      alert(tempErrMsg);
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
        generated_code: editableCode,
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
        timestamp: new Date().toLocaleString(),
        test_cases: testCases
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
      } else if (response.data.status === 'pending_approval') {
        alert(response.data.message || 'Your request to push code and simulated table to GitHub has been submitted for admin approval.');
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
    if (!xAxisParam || !yAxisParam) {
      return (
        <div className="flex flex-col items-center justify-center p-12 text-sm italic opacity-50 text-white/70">
          Please select both x-axis and y-axis parameters to visualize.
        </div>
      );
    }

    const subset = simulatedData.slice(0, subsetSize);
    const chartData: { label: string;[key: string]: any }[] = subset.map((row, idx) => {
      const labelVal = String(row[xAxisParam] ?? `Row ${idx + 1}`);
      return {
        label: labelVal,
        [yAxisParam]: Number(row[yAxisParam]) || 0
      };
    });

    // Stack Bar Grouping Logic
    const uniqueLabels: string[] = [];
    subset.forEach((row, idx) => {
      const label = String(row[xAxisParam] ?? `Row ${idx + 1}`);
      if (!uniqueLabels.includes(label)) {
        uniqueLabels.push(label);
      }
    });

    const potentialStackKeys = Object.keys(subset[0] || {}).filter(
      key => key !== xAxisParam && key !== yAxisParam
    );

    let stackKey = '';
    for (const key of potentialStackKeys) {
      const hasStringVal = subset.some(row => typeof row[key] === 'string' && isNaN(Number(row[key])));
      if (hasStringVal) {
        stackKey = key;
        break;
      }
    }

    if (!stackKey && potentialStackKeys.length > 0) {
      stackKey = potentialStackKeys[0];
    }

    const stackCategories: string[] = [];
    if (stackKey) {
      subset.forEach(row => {
        const cat = String(row[stackKey] ?? 'Unknown');
        if (!stackCategories.includes(cat)) {
          stackCategories.push(cat);
        }
      });
    } else {
      const counts = uniqueLabels.map(label =>
        subset.filter(row => String(row[xAxisParam] ?? '') === label).length
      );
      const maxGroupSize = Math.max(0, ...counts);
      for (let i = 0; i < maxGroupSize; i++) {
        stackCategories.push(`Segment ${i + 1}`);
      }
    }

    const groupedData = uniqueLabels.map(label => {
      const labelRows = subset.filter(row => String(row[xAxisParam] ?? '') === label);
      const segments: { [cat: string]: number } = {};
      let totalVal = 0;

      stackCategories.forEach((cat, idx) => {
        let val = 0;
        if (stackKey) {
          const matchingRows = labelRows.filter(row => String(row[stackKey] ?? 'Unknown') === cat);
          val = matchingRows.reduce((sum, r) => sum + (Number(r[yAxisParam]) || 0), 0);
        } else {
          const row = labelRows[idx];
          val = row ? (Number(row[yAxisParam]) || 0) : 0;
        }
        segments[cat] = val;
        totalVal += val;
      });

      return {
        label,
        segments,
        totalVal
      };
    });

    const colors = ['#EB1165', '#A31D1D', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];
    const width = 1000;
    const height = chartType === "Bar Chart" || chartType === "Stack Bar"
      ? Math.max(400, (chartType === "Stack Bar" ? uniqueLabels.length : chartData.length) * 35)
      : 400;

    // Linear Regression (Trend Line) Helpers
    const getTrendLine = (pts: { x: number; y: number }[]) => {
      const n = pts.length;
      if (n < 2) return null;

      let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
      for (const p of pts) {
        sumX += p.x;
        sumY += p.y;
        sumXY += p.x * p.y;
        sumXX += p.x * p.x;
      }

      const denominator = n * sumXX - sumX * sumX;
      if (denominator === 0) return null;

      const slope = (n * sumXY - sumX * sumY) / denominator;
      const intercept = (sumY - slope * sumX) / n;

      const startX = pts[0].x;
      const startY = slope * startX + intercept;
      const endX = pts[n - 1].x;
      const endY = slope * endX + intercept;

      return { x1: startX, y1: startY, x2: endX, y2: endY };
    };

    const getBarTrendLine = (pts: { x: number; y: number }[]) => {
      const n = pts.length;
      if (n < 2) return null;

      let sumX = 0, sumY = 0, sumXY = 0, sumYY = 0;
      for (const p of pts) {
        sumX += p.x;
        sumY += p.y;
        sumXY += p.x * p.y;
        sumYY += p.y * p.y;
      }

      const denominator = n * sumYY - sumY * sumY;
      if (denominator === 0) return null;

      const slope = (n * sumXY - sumX * sumY) / denominator;
      const intercept = (sumX - slope * sumY) / n;

      const startY = pts[0].y;
      const startX = slope * startY + intercept;
      const endY = pts[n - 1].y;
      const endX = slope * endY + intercept;

      return { x1: startX, y1: startY, x2: endX, y2: endY };
    };

    if (chartType === "Pie Chart" || chartType === "Donut Chart") {
      const pieData = chartData.map((item, idx) => ({
        label: item.label,
        value: Number(item[yAxisParam]) || 0,
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
                <div className="font-bold border-b pb-1 mb-2">Legend: {yAxisParam}</div>
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
        const val = Number(row[yAxisParam]) || 0;
        if (val > maxCellVal) maxCellVal = val;
      });

      return (
        <div className="p-4 overflow-x-auto select-none">
          <svg id="visualization-svg" width={paddingLeft + cellWidth + 50} height={paddingTop + chartData.length * cellHeight + 65} className="overflow-visible mx-auto">
            <text
              key={yAxisParam}
              x={paddingLeft + cellWidth / 2}
              y={paddingTop - 15}
              textAnchor="middle"
              className={`text-[10px] font-bold uppercase ${isDark ? 'fill-white/60' : 'fill-gray-500'}`}
            >
              {yAxisParam.length > 12 ? `${yAxisParam.slice(0, 10)}..` : yAxisParam}
            </text>

            {chartData.map((row, rIdx) => {
              const y = paddingTop + rIdx * cellHeight;
              const val = Number(row[yAxisParam]) || 0;
              const ratio = Math.max(0.05, Math.min(1, val / maxCellVal));
              const x = paddingLeft;

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

                  <g>
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
                </g>
              );
            })}

            {/* Y-axis Label */}
            <text
              transform={`rotate(-90, 25, ${paddingTop + (chartData.length * cellHeight) / 2})`}
              x={25}
              y={paddingTop + (chartData.length * cellHeight) / 2}
              textAnchor="middle"
              className={`text-xs font-bold ${isDark ? 'fill-white/60' : 'fill-gray-500'}`}
            >
              Visualizing {subsetSize} of the {simulatedData.length} records for {yAxisParam ? ` (${yAxisParam})` : ''}
            </text>

            {/* X-axis Label */}
            <text
              x={paddingLeft + cellWidth / 2}
              y={paddingTop + chartData.length * cellHeight + 45}
              textAnchor="middle"
              className={`text-xs font-bold ${isDark ? 'fill-white/60' : 'fill-gray-500'}`}
            >
              Parameter: {yAxisParam}
            </text>
          </svg>
        </div>
      );
    }

    const paddingLeft = chartType === "Bar Chart" || chartType === "Stack Bar" ? 140 : 90;
    const paddingRight = 40;
    const paddingTop = 40;
    const paddingBottom = chartType === "Bar Chart" || chartType === "Stack Bar" ? 70 : 75;
    const plotWidth = width - paddingLeft - paddingRight;
    const plotHeight = height - paddingTop - paddingBottom;

    let maxVal = 1;
    if (chartType === "Stack Bar") {
      groupedData.forEach(g => {
        if (g.totalVal > maxVal) maxVal = g.totalVal;
      });
    } else {
      chartData.forEach(row => {
        const val = Number(row[yAxisParam]) || 0;
        if (val > maxVal) maxVal = val;
      });
    }
    maxVal = Math.ceil(maxVal * 1.05);

    const step = maxVal / 5;
    const ticks = [0, step, step * 2, step * 3, step * 4, step * 5];

    if (chartType === "Bar Chart") {
      const barSpacing = plotHeight / chartData.length;
      const barHeight = Math.max(5, barSpacing * 0.6);

      const pointsForTrend = chartData.map((row, rIdx) => {
        const val = Number(row[yAxisParam]) || 0;
        const barWidth = (val / maxVal) * plotWidth;
        const yRow = paddingTop + rIdx * barSpacing;
        const barY = yRow + (barSpacing * 0.2);
        const centerY = barY + barHeight / 2;
        const screenX = paddingLeft + barWidth;
        return { x: screenX, y: centerY };
      });
      const barTrendLine = getBarTrendLine(pointsForTrend);
      console.log(barTrendLine)

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
              const val = Number(row[yAxisParam]) || 0;
              const barWidth = (val / maxVal) * plotWidth;
              const barY = yRow + (barSpacing * 0.2);
              const color = colors[0];

              return (
                <g key={rIdx}>
                  <text x={paddingLeft - 10} y={yRow + barSpacing / 2 + 4} textAnchor="end" className={`text-[10px] font-bold ${isDark ? 'fill-white/80' : 'fill-gray-600'}`}>
                    {row.label.length > 20 ? `${row.label.slice(0, 18)}..` : row.label}
                  </text>

                  <rect
                    x={paddingLeft}
                    y={barY}
                    width={Math.max(1, barWidth)}
                    height={barHeight}
                    fill={color}
                    rx="2"
                    className="transition-all duration-350 hover:brightness-110"
                  >
                    <title>{`${row.label} - ${yAxisParam}: ${val.toLocaleString()}`}</title>
                  </rect>
                </g>
              );
            })}
            <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={paddingTop + plotHeight} stroke={isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)"} />

            {/* Trend Line for Bar Chart flowing through the end of each bar */}
            {pointsForTrend.length >= 2 && (
              <path
                d={pointsForTrend.reduce((acc, p, idx) => idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`, "")}
                fill="none"
                stroke="#3B82F6"
                strokeWidth="2.5"
                strokeDasharray="6 4"
                className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
              />
            )}

            {/* Y-axis Label */}
            <text
              transform={`rotate(-90, 25, ${paddingTop + plotHeight / 2})`}
              x={25}
              y={paddingTop + plotHeight / 2}
              textAnchor="middle"
              className={`text-xs font-bold ${isDark ? 'fill-white/60' : 'fill-gray-500'}`}
            >
              Visualizing {subsetSize} of the {simulatedData.length} records for {xAxisParam}
            </text>

            {/* X-axis Label */}
            <text
              x={paddingLeft + plotWidth / 2}
              y={paddingTop + plotHeight + 45}
              textAnchor="middle"
              className={`text-xs font-bold ${isDark ? 'fill-white/60' : 'fill-gray-500'}`}
            >
              {yAxisParam}
            </text>
          </svg>
        </div>
      );
    }

    if (chartType === "Stack Bar") {
      const barSpacing = plotHeight / uniqueLabels.length;
      const barHeight = Math.max(15, barSpacing * 0.55);

      const stackTrendPoints = groupedData.map((g, rIdx) => {
        const yRow = paddingTop + rIdx * barSpacing;
        const barY = yRow + (barSpacing * 0.22);
        const centerY = barY + barHeight / 2;
        const screenX = paddingLeft + (g.totalVal / maxVal) * plotWidth;
        return { x: screenX, y: centerY };
      });

      return (
        <div className="flex flex-col gap-6 p-4">
          <div className="overflow-y-auto max-h-[550px] custom-scrollbar">
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

              {groupedData.map((g, rIdx) => {
                const yRow = paddingTop + rIdx * barSpacing;
                const barY = yRow + (barSpacing * 0.22);

                let currentX = paddingLeft;

                return (
                  <g key={rIdx}>
                    <text x={paddingLeft - 10} y={yRow + barSpacing / 2 + 4} textAnchor="end" className={`text-[10px] font-bold ${isDark ? 'fill-white/80' : 'fill-gray-600'}`}>
                      {g.label.length > 20 ? `${g.label.slice(0, 18)}..` : g.label}
                    </text>

                    {stackCategories.map((cat, catIdx) => {
                      const val = g.segments[cat] || 0;
                      if (val <= 0) return null;
                      const segmentWidth = (val / maxVal) * plotWidth;
                      const color = colors[catIdx % colors.length];
                      const startX = currentX;
                      currentX += segmentWidth;

                      return (
                        <rect
                          key={catIdx}
                          x={startX}
                          y={barY}
                          width={Math.max(1, segmentWidth)}
                          height={barHeight}
                          fill={color}
                          rx="2"
                          className="transition-all duration-350 hover:brightness-110"
                        >
                          <title>{`${g.label} - ${cat}: ${val.toLocaleString()}`}</title>
                        </rect>
                      );
                    })}
                  </g>
                );
              })}
              <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={paddingTop + plotHeight} stroke={isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)"} />

              {/* Trend Line for Stack Bar flowing through the end of each stacked bar */}
              {stackTrendPoints.length >= 2 && (
                <path
                  d={stackTrendPoints.reduce((acc, p, idx) => idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`, "")}
                  fill="none"
                  stroke="#3B82F6"
                  strokeWidth="2.5"
                  strokeDasharray="6 4"
                  className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
                />
              )}

              {/* Y-axis Label */}
              <text
                transform={`rotate(-90, 25, ${paddingTop + plotHeight / 2})`}
                x={25}
                y={paddingTop + plotHeight / 2}
                textAnchor="middle"
                className={`text-xs font-bold ${isDark ? 'fill-white/60' : 'fill-gray-500'}`}
              >
                Visualizing {subsetSize} of the {simulatedData.length} records for {xAxisParam}
              </text>

              {/* X-axis Label */}
              <text
                x={paddingLeft + plotWidth / 2}
                y={paddingTop + plotHeight + 45}
                textAnchor="middle"
                className={`text-xs font-bold ${isDark ? 'fill-white/60' : 'fill-gray-500'}`}
              >
                {yAxisParam}
              </text>
            </svg>
          </div>

          {/* Legend */}
          {stackKey && (
            <div className={`p-4 rounded-2xl border flex flex-wrap gap-x-6 gap-y-3 text-xs ${isDark ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-150'}`}>
              <div className={`font-bold w-full border-b pb-1.5 ${isDark ? 'text-white border-white/10' : 'text-gray-700 border-gray-200'}`}>Legend (stacked by {stackKey}):</div>
              {stackCategories.map((cat, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded shrink-0" style={{ backgroundColor: colors[idx % colors.length] }} />
                  <span className={`font-semibold ${isDark ? 'text-white/80' : 'text-gray-700'}`}>{cat}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    const columnWidth = plotWidth / chartData.length;

    // Compute points for trend line in non-bar charts
    const trendPoints = chartData.map((row, rIdx) => {
      const val = Number(row[yAxisParam]) || 0;
      const x = paddingLeft + rIdx * columnWidth + columnWidth / 2;
      const y = paddingTop + plotHeight - (val / maxVal) * plotHeight;
      return { x, y };
    });
    const trend = getTrendLine(trendPoints);
    console.log(trend)

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
            const labelInterval = Math.max(1, Math.ceil(totalLabels / 25));
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
            const barWidth = Math.max(4, columnWidth * 0.6);
            const val = Number(row[yAxisParam]) || 0;
            const barHeight = (val / maxVal) * plotHeight;
            const xBar = xRow + columnWidth * 0.2;
            const color = colors[0];

            return (
              <rect
                key={rIdx}
                x={xBar}
                y={paddingTop + plotHeight - barHeight}
                width={barWidth}
                height={Math.max(1, barHeight)}
                fill={color}
                rx="2"
                className="transition-all duration-350 hover:brightness-110"
              >
                <title>{`${row.label} - ${yAxisParam}: ${val.toLocaleString()}`}</title>
              </rect>
            );
          })}

          {chartType === "Line Graph" && (() => {
            const color = colors[0];
            const pathD = trendPoints.reduce((acc, p, idx) =>
              idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`
              , "");

            return (
              <g>
                <path d={pathD} fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                {trendPoints.map((p, idx) => (
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
                    <title>{`${chartData[idx].label} - ${yAxisParam}: ${chartData[idx][yAxisParam].toLocaleString()}`}</title>
                  </circle>
                ))}
              </g>
            );
          })()}

          {chartType === "Scatter Plots" && (
            <g>
              {trendPoints.map((p, rIdx) => (
                <circle
                  key={rIdx}
                  cx={p.x}
                  cy={p.y}
                  r="6.5"
                  fill={colors[0]}
                  opacity="0.85"
                  className="cursor-pointer transition-transform duration-200 hover:scale-150"
                >
                  <title>{`${chartData[rIdx].label} - ${yAxisParam}: ${chartData[rIdx][yAxisParam].toLocaleString()}`}</title>
                </circle>
              ))}
            </g>
          )}
          <line x1={paddingLeft} y1={paddingTop + plotHeight} x2={paddingLeft + plotWidth} y2={paddingTop + plotHeight} stroke={isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)"} />

          {/* Trend Line for Line Graph 
          {trend && chartType === "Line Graph" && (
            <line
              x1={trend.x1}
              y1={trend.y1}
              x2={trend.x2}
              y2={trend.y2}
              stroke="#3B82F6"
              strokeWidth="2.5"
              strokeDasharray="6 4"
              className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
            />
          )}*/}

          {/* Trend Line flowing through points for Column Chart and Scatter Plots */}
          {(chartType === "Column Chart" || chartType === "Scatter Plots") && trendPoints.length >= 2 && (
            <path
              d={trendPoints.reduce((acc, p, idx) => idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`, "")}
              fill="none"
              stroke="#3B82F6"
              strokeWidth="2.5"
              strokeDasharray="6 4"
              className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
            />
          )}

          {/* Y-axis Label */}
          <text
            transform={`rotate(-90, 25, ${paddingTop + plotHeight / 2})`}
            x={25}
            y={paddingTop + plotHeight / 2}
            textAnchor="middle"
            className={`text-xs font-bold ${isDark ? 'fill-white/60' : 'fill-gray-500'}`}
          >
            {yAxisParam}
          </text>

          {/* X-axis Label */}
          <text
            x={paddingLeft + plotWidth / 2}
            y={paddingTop + plotHeight + 52}
            textAnchor="middle"
            className={`text-xs font-bold ${isDark ? 'fill-white/60' : 'fill-gray-500'}`}
          >
            Visualizing {subsetSize} of the {simulatedData.length} records for {xAxisParam}
          </text>
        </svg>
      </div>
    );
  };

  const handleGenerateTestCases = async () => {
    if (!code || !formData) return;
    setIsGeneratingTestCases(true);
    try {
      const response = await axios.post(`${apiBaseUrl}/generate-test-cases`, {
        logic: formData.logic,
        format: formData.format,
        tables: formData.tables,
        columns: formData.columns,
        generated_code: code,
        model: formData.model || 'gpt-4o'
      });
      setTestCases(response.data || []);
    } catch (err: any) {
      console.error('Failed to generate test cases:', err);
      alert('Failed to generate test cases: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsGeneratingTestCases(false);
    }
  };

  const handleRunTestCase = async (index: number) => {
    if (!code || !formData) return;
    const testCase = testCases[index];
    if (!testCase) return;
    setRunningTestCaseIndex(index);
    try {
      const response = await axios.post(`${apiBaseUrl}/run-test-case`, {
        generated_code: code,
        format: formData.format,
        tables: formData.tables,
        columns: formData.columns,
        mock_inputs: testCase.mock_inputs,
        expected_output: testCase.expected_output
      });
      setTestCaseResults(prev => ({
        ...prev,
        [index]: response.data
      }));
    } catch (err: any) {
      console.error('Failed to run test case:', err);
      setTestCaseResults(prev => ({
        ...prev,
        [index]: {
          passed: false,
          status: 'Fail',
          message: 'Server error: ' + (err.response?.data?.detail || err.message),
          actual_row_count: 0,
          actual_output: []
        }
      }));
    } finally {
      setRunningTestCaseIndex(null);
    }
  };

  const handleStoreSemanticCache = async () => {
    if (!editableCode || !formData) return;
    setIsStoringCache(true);
    try {
      const response = await axios.post(`${apiBaseUrl}/cache/store`, {
        query: formData.logic,
        format: formData.format,
        tables: formData.tables,
        columns: formData.columns,
        code: editableCode,
        userId: user?.userId
      });
      alert(response.data.message || 'Stored in Semantic Cache successfully!');
    } catch (err: any) {
      console.error('Failed to store in semantic cache:', err);
      alert('Failed to store in semantic cache: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsStoringCache(false);
    }
  };

  const renderTestCasesSection = () => {
    if (!showTestCasesSection || testCases.length === 0) return null;
    return (
      <div className={`mt-6 p-6 rounded-2xl border transition-all duration-400 ${isDark
        ? 'bg-axis-burgundy-dark/40 border-white/10'
        : 'bg-white border-gray-200 shadow-xl'}`}>
        <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" />
            <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>
              Generated Test Cases & Scenarios
            </h3>
          </div>
          <button
            onClick={() => {
              const resultsArr = Object.values(testCaseResults);
              const passedCount = resultsArr.filter(r => r.passed).length;
              const totalRun = resultsArr.length;
              alert(`Test Report Summary:\n----------------------\nTotal Run: ${totalRun}/${testCases.length}\nPassed: ${passedCount}\nFailed: ${totalRun - passedCount}\nStatus: ${passedCount === testCases.length ? 'ALL PASSED 🎉' : 'PENDING / FAILED'}`);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${isDark
              ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30'
              : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200'}`}
          >
            <Save className="w-3.5 h-3.5" />
            Generate Test Report
          </button>
        </div>

        <div className="space-y-4">
          {testCases.map((tc, idx) => {
            const result = testCaseResults[idx];
            const isRunning = runningTestCaseIndex === idx;
            return (
              <div key={idx} className={`p-4 rounded-xl border transition-all ${isDark
                ? 'bg-black/20 border-white/5 hover:border-white/10'
                : 'bg-gray-50 border-gray-100 hover:border-gray-200 shadow-sm'}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                  <div>
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold mr-2 ${tc.scenario_type === 'Positive'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/15 text-rose-400 border border-rose-500/20'}`}>
                      {tc.scenario_type}
                    </span>
                    <span className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-800'}`}>
                      {tc.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {result && (
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1 ${result.passed
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                        {result.passed ? 'PASS' : 'FAIL'}
                      </span>
                    )}
                    <button
                      onClick={() => handleRunTestCase(idx)}
                      disabled={isRunning}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${isDark
                        ? 'bg-white/10 hover:bg-white/15 text-white disabled:opacity-40'
                        : 'bg-white hover:bg-gray-150 text-gray-700 border border-gray-200'}`}
                    >
                      {isRunning ? (
                        <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        'Run Test'
                      )}
                    </button>
                  </div>
                </div>

                <p className={`text-xs opacity-75 mb-3 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  {tc.description}
                </p>

                {/* Collapsible Mock Data Details */}
                <details className="mt-2 group">
                  <summary className="text-xs font-semibold text-blue-400 cursor-pointer hover:underline list-none flex items-center gap-1.5 select-none">
                    <span className="transition-transform group-open:rotate-90">▶</span> View Mock Inputs & Expected Outputs
                  </summary>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {/* Mock Inputs column */}
                    <div className={`p-3 rounded-lg border ${isDark ? 'bg-black/40 border-white/5' : 'bg-white border-gray-200'}`}>
                      <h4 className="font-bold mb-2 text-blue-300">Mock Inputs:</h4>
                      {Object.entries(tc.mock_inputs || {}).map(([tbl, rows]: any) => (
                        <div key={tbl} className="mb-2">
                          <div className="font-semibold text-emerald-400 mb-1">{tbl} ({rows.length} rows):</div>
                          <pre className="p-2 bg-black/30 rounded text-[10px] overflow-x-auto max-h-40 whitespace-pre">
                            {JSON.stringify(rows, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>

                    {/* Expected & Actual Outputs column */}
                    <div className={`p-3 rounded-lg border ${isDark ? 'bg-black/40 border-white/5' : 'bg-white border-gray-200'} flex flex-col justify-between`}>
                      <div>
                        <h4 className="font-bold mb-2 text-blue-300">Expected Output:</h4>
                        <ul className="space-y-1.5 list-disc pl-4 opacity-90">
                          <li><strong>Expected Rows:</strong> {tc.expected_output?.expected_row_count}</li>
                          <li><strong>Description:</strong> {tc.expected_output?.description}</li>
                        </ul>
                      </div>

                      {result && (
                        <div className="mt-4 pt-3 border-t border-white/10">
                          <h4 className="font-bold mb-1.5 text-blue-305">Actual Output Details:</h4>
                          <ul className="space-y-1 list-disc pl-4 opacity-90 mb-2">
                            <li><strong>Actual Rows:</strong> {result.actual_row_count}</li>
                            <li><strong>Result Message:</strong> {result.message}</li>
                          </ul>
                          {result.actual_output && result.actual_output.length > 0 && (
                            <details className="mt-1">
                              <summary className="text-[10px] text-emerald-400 cursor-pointer hover:underline select-none">View Actual Rows Data</summary>
                              <pre className="mt-1.5 p-2 bg-black/30 rounded text-[9px] overflow-x-auto max-h-32 whitespace-pre">
                                {JSON.stringify(result.actual_output, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderLineageVisualizer = () => {
    if (!showLineage) return null;
    return (
      <section className="space-y-4 mt-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-2 font-semibold uppercase text-xs tracking-widest ${isDark ? 'text-axis-cream' : 'text-axis-burgundy'}`}>
            <GitBranch className="w-4 h-4 animate-pulse" /> Dynamic Column Lineage - Directed Acyclic Graphs (DAG)
          </div>
          <button
            onClick={handleExportLineage}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${isDark
              ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/30'
              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'}`}
          >
            <Download className="w-3.5 h-3.5" /> Export Lineage (PNG)
          </button>
        </div>

        <div className={`rounded-2xl p-6 shadow-xl border overflow-x-auto transition-colors duration-400 ${isDark
          ? 'bg-axis-burgundy-dark/40 border-white/10'
          : 'bg-white border-gray-200'}`}>
          <p className={`text-xs mb-6 ${isDark ? 'text-white/60' : 'text-gray-550'}`}>
            Interactive visualization of data flow and columns mapping. Hover over any target column node on the right to trace its upstream source columns.
          </p>

          <div className="min-w-[1000px] flex justify-center">
            <svg id="lineage-svg" width={1000} height={Math.max(450, Math.max(lineageNodes.uniqueSources.length * 70, lineageNodes.targets.length * 80) + 100)} className="overflow-visible select-none">
              <defs>
                <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
                  <feDropShadow dx="0" dy="1.5" stdDeviation="2" flood-color="#000000" flood-opacity="0.1" />
                </filter>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Connections (Bézier curves) */}
              <g>
                {lineageNodes.targets.map((tgt, tIdx) => {
                  const targetY = 50 + tIdx * 80 + 22.5;
                  const transX1 = 400;
                  const transX2 = 600;

                  const lin = columnDetailsMap[tgt]?.lineage;
                  if (!lin) return null;

                  const srcTables = lin.source_tables || [];
                  const srcCols = lin.source_columns || [];

                  const isHovered = hoveredTargetCol === tgt;
                  const isAnyHovered = hoveredTargetCol !== null;
                  const pathOpacity = isAnyHovered ? (isHovered ? 1.0 : 0.08) : 0.5;
                  const pathStroke = isHovered ? '#EB1165' : '#94A3B8';
                  const strokeWidth = isHovered ? 3.5 : 1.5;

                  return (
                    <g key={`paths-${tgt}`}>
                      <path
                        d={`M ${transX2} ${targetY} C ${(transX2 + 730) / 2} ${targetY}, ${(transX2 + 730) / 2} ${targetY}, 730 ${targetY}`}
                        fill="none"
                        stroke={pathStroke}
                        strokeWidth={strokeWidth}
                        style={{ opacity: pathOpacity }}
                        className="transition-all duration-300"
                      />

                      {srcCols.map((col: string, sIdx: number) => {
                        const tbl = srcTables[sIdx] || srcTables[0] || 'Unknown Table';
                        const key = `${tbl}.${col}`;
                        const sourceIdx = lineageNodes.uniqueSources.indexOf(key);
                        if (sourceIdx === -1) return null;

                        const sourceY = 50 + sourceIdx * 70 + 22.5;

                        return (
                          <path
                            key={`curve-${tgt}-${key}`}
                            d={`M 270 ${sourceY} C ${(270 + transX1) / 2} ${sourceY}, ${(270 + transX1) / 2} ${targetY}, ${transX1} ${targetY}`}
                            fill="none"
                            stroke={pathStroke}
                            strokeWidth={strokeWidth}
                            style={{ opacity: pathOpacity }}
                            className="transition-all duration-300"
                          />
                        );
                      })}
                    </g>
                  );
                })}
              </g>

              {/* Left Port Sources */}
              <g>
                {lineageNodes.uniqueSources.map((src, idx) => {
                  const y = 50 + idx * 70;
                  const [tbl, col] = src.split('.');
                  return (
                    <g key={src} className="transition-all duration-300">
                      <rect
                        x={50}
                        y={y}
                        width={220}
                        height={45}
                        rx={8}
                        fill={isDark ? '#1e1b1e' : '#f8fafc'}
                        stroke={isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}
                        strokeWidth="1.5"
                        filter="url(#shadow)"
                      />
                      <text x={65} y={y + 18} className="text-[10px] font-bold fill-axis-red opacity-80 uppercase tracking-wide">
                        {tbl}
                      </text>
                      <text x={65} y={y + 33} className={`text-[12px] font-mono font-bold ${isDark ? 'fill-gray-100' : 'fill-gray-700'}`}>
                        {col}
                      </text>
                      <circle cx={270} cy={y + 22.5} r={4} className="fill-axis-red" />
                    </g>
                  );
                })}
              </g>

              {/* Middle Port Transforms */}
              <g>
                {lineageNodes.targets.map((tgt, idx) => {
                  const y = 50 + idx * 80;
                  const lin = columnDetailsMap[tgt]?.lineage;
                  const transDesc = lin?.transformation || 'Direct data ingest copy';
                  const truncatedDesc = transDesc.length > 25 ? `${transDesc.slice(0, 22)}...` : transDesc;

                  const isHovered = hoveredTargetCol === tgt;
                  const isAnyHovered = hoveredTargetCol !== null;
                  const opacity = isAnyHovered ? (isHovered ? 1.0 : 0.2) : 1.0;

                  return (
                    <g key={`trans-${tgt}`} style={{ opacity }} className="transition-all duration-300">
                      <rect
                        x={400}
                        y={y}
                        width={200}
                        height={45}
                        rx={8}
                        fill={isDark ? 'rgba(235,17,101,0.05)' : 'rgba(235,17,101,0.02)'}
                        stroke={isHovered ? '#EB1165' : (isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9')}
                        strokeWidth={isHovered ? 2 : 1}
                        filter="url(#shadow)"
                      />
                      <text x={415} y={y + 18} className="text-[9px] font-bold fill-axis-red uppercase tracking-wider">
                        Transformation
                      </text>
                      <text x={415} y={y + 33} className={`text-[11px] font-medium italic ${isDark ? 'fill-gray-300' : 'fill-gray-600'}`}>
                        {truncatedDesc}
                        <title>{transDesc}</title>
                      </text>
                      <circle cx={400} cy={y + 22.5} r={3} className={isDark ? 'fill-white/30' : 'fill-gray-400'} />
                      <circle cx={600} cy={y + 22.5} r={3} className={isDark ? 'fill-white/30' : 'fill-gray-400'} />
                    </g>
                  );
                })}
              </g>

              {/* Right Port Targets */}
              <g>
                {lineageNodes.targets.map((tgt, idx) => {
                  const y = 50 + idx * 80;
                  const isHovered = hoveredTargetCol === tgt;
                  const isAnyHovered = hoveredTargetCol !== null;
                  const opacity = isAnyHovered ? (isHovered ? 1.0 : 0.25) : 1.0;

                  return (
                    <g
                      key={`tgt-${tgt}`}
                      onMouseEnter={() => setHoveredTargetCol(tgt)}
                      onMouseLeave={() => setHoveredTargetCol(null)}
                      style={{ opacity }}
                      className="transition-all duration-300 cursor-pointer"
                    >
                      <rect
                        x={730}
                        y={y}
                        width={220}
                        height={45}
                        rx={8}
                        fill={isHovered ? (isDark ? 'rgba(235,17,101,0.15)' : 'rgba(235,17,101,0.05)') : (isDark ? '#1e1b1e' : '#f8fafc')}
                        stroke={isHovered ? '#EB1165' : (isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0')}
                        strokeWidth={isHovered ? 2 : 1.5}
                        filter="url(#shadow)"
                      />
                      <text x={745} y={y + 18} className="text-[10px] font-bold fill-axis-red uppercase tracking-wider">
                        Target Column
                      </text>
                      <text x={745} y={y + 33} className={`text-[12px] font-mono font-bold ${isDark ? 'fill-gray-100' : 'fill-gray-700'}`}>
                        {tgt}
                      </text>
                      <circle cx={730} cy={y + 22.5} r={4} className="fill-axis-red" />
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>
        </div>
      </section>
    );
  };

  const renderDqInsightsSection = () => {
    if (simulatedData.length === 0) return null;

    return (
      <section className="space-y-4 animate-in fade-in duration-300">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className={`flex items-center gap-2 font-semibold uppercase text-xs tracking-widest ${isDark ? 'text-axis-cream' : 'text-axis-red'}`}>
              <Activity className="w-4 h-4" /> DQ Insights
            </div>
            {Object.keys(allTablesData).length > 0 && (
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
                  {Object.keys(allTablesData).map((table: string) => (
                    <option key={table} value={table} className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>
                      {table}
                    </option>
                  ))}
                </select>

                {availableDqColumns.length > 0 && (
                  <>
                    <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-white/50' : 'text-gray-555'}`}>
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

          <div className="flex items-center gap-3">
            {/* MultiSelect metrics selection Checklist dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDqParamsDropdownOpen(prev => !prev)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 hover:scale-[1.01] ${isDark
                  ? 'border-white/10 bg-white/5 hover:bg-white/10 text-white'
                  : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'}`}
              >
                Select Metrics ({selectedDqParams.length})
              </button>
              {isDqParamsDropdownOpen && (
                <div className={`absolute right-0 mt-2 w-64 rounded-2xl shadow-2xl border p-4 z-10 transition-all ${isDark
                  ? 'bg-axis-burgundy-dark text-white border-white/10'
                  : 'bg-white text-gray-800 border-gray-200'}`}>
                  <div className="flex justify-between items-center pb-2 mb-2 border-b border-white/10">
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Metrics Checklist</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedDqParams.length === dqConfigParams.length && dqConfigParams.length > 0}
                        onChange={() => {
                          if (selectedDqParams.length === dqConfigParams.length) {
                            setSelectedDqParams([]);
                          } else {
                            setSelectedDqParams(dqConfigParams.map(p => p.key));
                          }
                        }}
                        className="rounded text-axis-red focus:ring-axis-red cursor-pointer w-3.5 h-3.5"
                        title={selectedDqParams.length === dqConfigParams.length ? "Deselect all" : "Select all"}
                      />
                      <button
                        type="button"
                        onClick={fetchDqConfigParams}
                        disabled={isRefreshingParams}
                        className={`p-1 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/10 ${
                          isDark ? 'text-white/60 hover:text-white' : 'text-gray-500 hover:text-gray-800'
                        }`}
                        title="Refresh parameters"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingParams ? 'animate-spin' : ''}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsDqParamsDropdownOpen(false)}
                        className="text-xs font-bold text-axis-red hover:underline"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {dqConfigParams.map((param) => {
                      const checked = selectedDqParams.includes(param.key);
                      return (
                        <label key={param.key} className="flex items-start gap-2 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 p-1 rounded transition-colors text-left text-xs">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              if (checked) {
                                setSelectedDqParams(selectedDqParams.filter(k => k !== param.key));
                              } else {
                                setSelectedDqParams([...selectedDqParams, param.key]);
                              }
                            }}
                            className="mt-0.5 rounded text-axis-red focus:ring-axis-red"
                          />
                          <div>
                            <div className="font-bold">{param.name}</div>
                            <div className="text-[10px] opacity-60">{param.description}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleGenerateDqInsights}
              disabled={isCalculatingDq || !selectedDqColumn}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold text-white transition-all hover:scale-[1.02] flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${isDark
                ? 'bg-gradient-to-r from-axis-red to-axis-burgundy'
                : 'bg-gradient-to-r from-axis-burgundy to-axis-red'}`}
            >
              {isCalculatingDq ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : null}
              {isCalculatingDq ? 'Generating...' : 'Generate DQ Insights'}
            </button>
          </div>
        </div>

        {Object.keys(calculatedDqMetrics).length === 0 ? (
          <div className={`p-8 text-center rounded-2xl border text-xs font-semibold ${isDark ? 'bg-axis-burgundy-dark/20 border-white/10 text-white/50' : 'bg-gray-50 border-gray-150 text-gray-500'}`}>
            Select parameters and click "Generate DQ Insights" to view metrics.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-200">
            {dqConfigParams.filter(p => selectedDqParams.includes(p.key)).map((param) => {
              const value = calculatedDqMetrics[param.key];
              let colorClass = '';
              if (param.key === 'null_values' && Number(value) > 0) colorClass = isDark ? 'text-red-400' : 'text-red-600';
              else if (param.key === 'duplicate_rows' && Number(value) > 0) colorClass = isDark ? 'text-orange-400' : 'text-orange-600';
              else if (param.key === 'distinct_values') colorClass = isDark ? 'text-emerald-400' : 'text-emerald-600';

              return (
                <div key={param.key} className={`p-5 rounded-xl transition-colors group shadow-sm duration-400 border text-left flex flex-col justify-between ${isDark
                  ? 'bg-axis-burgundy-dark/50 border-white/10 hover:border-axis-red/40 text-white'
                  : 'bg-white border border-gray-200 hover:border-axis-burgundy/30 text-gray-800'}`}>
                  <div>
                    <div className={`text-xs font-semibold mb-1 ${isDark ? 'text-white/50' : 'text-gray-555'}`}>{param.name}</div>
                    <div className={`text-2xl font-bold group-hover:scale-105 transition-transform origin-left ${colorClass || (isDark ? 'text-white' : 'text-gray-905')}`}>
                      {value !== null && value !== undefined ? String(value) : '-'}
                    </div>
                  </div>
                  <div className="text-[10px] opacity-40 mt-2 border-t pt-1 dark:border-white/5 border-gray-100">{param.description}</div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    );
  };

  return (
    <div className={`flex-1 p-8 overflow-y-auto transition-colors duration-400 ${isDark ? 'bg-axis-burgundy-deep' : 'bg-axis-gray'}`}>
      <div className="max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-300">

        {/* HEADER */}
        <header className="flex justify-between items-center">
          <h1 className={`text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-axis-red'}`}>
            {activeTab === 'sdlc' ? 'Code Output & DQ Insights' : 'Query Plan & Code Output'}
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
                <div className={`flex items-center justify-between px-4 py-3 border-b transition-colors duration-400 ${isDark ? 'bg-black/20 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                  </div>
                  {editableCode && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleOpenEditModal}
                        className={`p-1.5 rounded-lg border transition-all duration-200 flex items-center justify-center ${isDark
                          ? 'border-white/10 hover:bg-white/10 text-gray-400 hover:text-white'
                          : 'border-gray-200 hover:bg-gray-100 text-gray-500 hover:text-gray-900'}`}
                        title="Edit code"
                      >
                        <Edit2 className="w-3.5 h-3.5 transition-transform duration-200 hover:scale-110" />
                      </button>
                      <button
                        onClick={handleCopyCode}
                        className={`p-1.5 rounded-lg border transition-all duration-200 flex items-center justify-center ${isDark
                          ? 'border-white/10 hover:bg-white/10 text-gray-400 hover:text-white'
                          : 'border-gray-200 hover:bg-gray-100 text-gray-500 hover:text-gray-900'}`}
                        title="Copy code to clipboard"
                      >
                        {isCopied ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500 animate-in zoom-in duration-200" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 transition-transform duration-200 hover:scale-110" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
                <pre className={`p-6 font-mono text-sm leading-relaxed whitespace-pre-wrap break-all overflow-x-auto min-h-[300px] ${isLoading ? 'animate-pulse-subtle' : ''}`}>
                  <code className={isDark ? 'text-gray-200' : 'text-gray-700'}>
                    {isLoading ? (
                      <span className={isDark ? 'text-white/40' : 'text-gray-400'}>Generating intelligent code structures...</span>
                    ) : (
                      editableCode || <span className={`italic ${isDark ? 'text-white/30' : 'text-gray-400'}`}>// Your generated code will appear here...</span>
                    )}
                  </code>
                </pre>
              </div>
            </section>

            {/* Run Code Button Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                {/* Output Guardrails Status Indicator */}
                {simulatedData.length > 0 && outputGuardrailsStatus && (
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${outputGuardrailsStatus.passed
                    ? (isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-lg shadow-emerald-500/5' : 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm')
                    : (isDark ? 'bg-red-500/10 text-red-400 border-red-500/20 shadow-lg shadow-red-500/5' : 'bg-red-50 text-red-700 border-red-200 shadow-sm')
                    }`}>
                    {outputGuardrailsStatus.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    )}
                    <span>
                      {outputGuardrailsStatus.passed ? 'Output Guardrails passed.' : 'Output Guardrails violated.'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsOutputGuardrailsModalOpen(true)}
                      className={`p-1 rounded transition-colors ${isDark ? 'hover:bg-white/10 text-white/60 hover:text-white' : 'hover:bg-black/5 text-gray-555 hover:text-gray-800'
                        }`}
                      title="View checked output guardrails"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 shrink-0">
                {simulationData?.execution_explanation && (
                  <button
                    onClick={() => setIsExplanationOpen(true)}
                    className={`px-3 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 border ${isDark
                      ? 'bg-axis-red/20 hover:bg-axis-red/30 text-white border-axis-red/30'
                      : 'bg-red-50 hover:bg-red-100 text-axis-burgundy border-red-200'}`}
                  >
                    <Info className="w-4 h-4" />
                    Execution Explanation
                  </button>
                )}
                {editableCode && (
                  <button
                    onClick={handleGenerateLineage}
                    className={`px-3 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 border ${isDark
                      ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-blue-500/30'
                      : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-200'}`}
                  >
                    <GitBranch className="w-4 h-4" />
                    {showLineage ? "Hide Lineage" : "Show Lineage"}
                  </button>
                )}
                <button
                  onClick={handleStoreSemanticCache}
                  disabled={!editableCode || isStoringCache || isLoading}
                  className={`px-3 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${isDark
                    ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'}`}
                >
                  {isStoringCache ? (
                    <div className="w-4 h-4 border-2 border-amber-300/30 border-t-amber-300 rounded-full animate-spin" />
                  ) : (
                    <Database className="w-4 h-4" />
                  )}
                  Store at Semantic Cache
                </button>

                <button
                  onClick={() => {
                    if (testCases.length > 0) {
                      setShowTestCasesSection(prev => !prev);
                    } else {
                      handleGenerateTestCases();
                    }
                  }}
                  disabled={!editableCode || isGeneratingTestCases || isLoading}
                  className={`px-3 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${isDark
                    ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30'
                    : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200'}`}
                >
                  {isGeneratingTestCases ? (
                    <div className="w-4 h-4 border-2 border-blue-300/30 border-t-blue-300 rounded-full animate-spin" />
                  ) : (
                    <CheckSquare className="w-4 h-4" />
                  )}
                  {testCases.length > 0
                    ? (showTestCasesSection ? 'Hide Test Cases' : 'Show Test Cases')
                    : 'Generate Test Cases'}
                </button>

                <button
                  onClick={handleRunCode}
                  disabled={!editableCode || isSimulating || isLoading}
                  className={`px-3 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${isDark
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
            </div>

            {renderTestCasesSection()}

            {renderLineageVisualizer()}

            {/* Simulated Output Preview Section */}
            {simulatedData.length > 0 && (
              <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className={`flex items-center gap-2 font-semibold uppercase text-xs tracking-widest ${isDark ? 'text-axis-cream' : 'text-axis-burgundy'}`}>
                  <Database className="w-4 h-4" /> Simulated Output Preview
                </div>

                {/* Controls Row */}
                <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
                  <div className="flex flex-col sm:flex-row gap-3 flex-1">
                    {/* Table Select Dropdown */}
                    {Object.keys(allTablesData).length > 0 && (
                      <div className="relative flex-1 max-w-xs">
                        <select
                          value={selectedPreviewTable}
                          onChange={(e) => {
                            setSelectedPreviewTable(e.target.value);
                            setSelectedDqTable(e.target.value);
                          }}
                          className={`w-full px-3 py-2 text-sm rounded-xl focus:outline-none focus:ring-2 cursor-pointer transition-all ${isDark
                            ? 'bg-white/10 border border-white/10 text-white focus:ring-axis-red/30'
                            : 'bg-white border border-gray-200 text-gray-700 focus:ring-axis-burgundy/20'}`}
                        >
                          {Object.keys(allTablesData).map((tbl) => (
                            <option key={tbl} value={tbl} className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>
                              {tbl}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

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

                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold whitespace-nowrap ${isDark ? 'text-white/50' : 'text-gray-555'}`}>
                        Export As:
                      </span>
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
                        <option value="CSV" className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>CSV</option>
                        <option value="XLS" className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>Excel (XLS)</option>
                      </select>
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
            {renderDqInsightsSection()}
          </>
        ) : (
          // Conversational BI Tab Rendering Block
          <>
            {/* side-by-side Code & Flow Explanation Section */}
            <div className="flex flex-col md:flex-row gap-6">

              {/* Flow Explanation Card */}
              <section className="flex-1 min-w-0 space-y-4">
                <div className={`flex items-center gap-2 p-2 font-semibold uppercase text-xs tracking-widest ${isDark ? 'text-axis-cream' : 'text-axis-burgundy'}`}>
                  <Info className="w-4 h-4" /> Query Plan
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
                      {(flowExplanation.includes('1.')) ? (
                        <pre className="whitespace-pre-wrap text-xs font-medium leading-relaxed p-4 rounded-xl bg-white/5 border border-white/5">
                          {flowExplanation}
                        </pre>)
                        : (
                          flowExplanation
                            .split('.')
                            .map(s => s.trim())
                            .filter(Boolean)
                            .map((sentence, idx) => (
                              <li key={idx} className="leading-relaxed">
                                {sentence}.
                              </li>
                            ))
                        )
                      }
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
                  <div className={`flex items-center justify-between px-4 py-3 border-b transition-colors duration-400 ${isDark ? 'bg-black/20 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                    </div>
                    {editableCode && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleOpenEditModal}
                          className={`p-1.5 rounded-lg border transition-all duration-200 flex items-center justify-center ${isDark
                            ? 'border-white/10 hover:bg-white/10 text-gray-400 hover:text-white'
                            : 'border-gray-200 hover:bg-gray-100 text-gray-500 hover:text-gray-900'}`}
                          title="Edit code"
                        >
                          <Edit2 className="w-3.5 h-3.5 transition-transform duration-200 hover:scale-110" />
                        </button>
                        <button
                          onClick={handleCopyCode}
                          className={`p-1.5 rounded-lg border transition-all duration-200 flex items-center justify-center ${isDark
                            ? 'border-white/10 hover:bg-white/10 text-gray-400 hover:text-white'
                            : 'border-gray-200 hover:bg-gray-100 text-gray-500 hover:text-gray-900'}`}
                          title="Copy code to clipboard"
                        >
                          {isCopied ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500 animate-in zoom-in duration-200" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 transition-transform duration-200 hover:scale-110" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                  <pre className={`p-5 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all min-h-[260px] max-h-[350px] overflow-y-auto ${isLoading ? 'animate-pulse-subtle' : ''}`}>
                    <code className={isDark ? 'text-gray-200' : 'text-gray-700'}>
                      {isLoading ? (
                        <span className={isDark ? 'text-white/40' : 'text-gray-400'}>Generating SQL code snippet...</span>
                      ) : (
                        editableCode || <span className={`italic ${isDark ? 'text-white/30' : 'text-gray-400'}`}>-- SQL query output will appear here...</span>
                      )}
                    </code>
                  </pre>
                </div>}
              </section>
            </div>

            {/* Run Code Button Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                {/* Output Guardrails Status Indicator */}
                {simulatedData.length > 0 && outputGuardrailsStatus && (
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${outputGuardrailsStatus.passed
                    ? (isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-lg shadow-emerald-500/5' : 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm')
                    : (isDark ? 'bg-red-500/10 text-red-400 border-red-500/20 shadow-lg shadow-red-500/5' : 'bg-red-50 text-red-700 border-red-200 shadow-sm')
                    }`}>
                    {outputGuardrailsStatus.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    )}
                    <span>
                      {outputGuardrailsStatus.passed ? 'Output Guardrails passed.' : 'Output Guardrails violated.'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsOutputGuardrailsModalOpen(true)}
                      className={`p-1 rounded transition-colors ${isDark ? 'hover:bg-white/10 text-white/60 hover:text-white' : 'hover:bg-black/5 text-gray-555 hover:text-gray-800'
                        }`}
                      title="View checked output guardrails"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 shrink-0">
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
                {editableCode && (
                  <button
                    onClick={handleGenerateLineage}
                    className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 border ${isDark
                      ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-blue-500/30'
                      : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-200'}`}
                  >
                    <GitBranch className="w-4 h-4" />
                    {showLineage ? "Hide Lineage" : "Show Lineage"}
                  </button>
                )}
                <button
                  onClick={handleStoreSemanticCache}
                  disabled={!editableCode || isStoringCache || isLoading}
                  className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${isDark
                    ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'}`}
                >
                  {isStoringCache ? (
                    <div className="w-4 h-4 border-2 border-amber-300/30 border-t-amber-300 rounded-full animate-spin" />
                  ) : (
                    <Database className="w-4 h-4" />
                  )}
                  Store at Semantic Cache
                </button>

                <button
                  onClick={() => {
                    if (testCases.length > 0) {
                      setShowTestCasesSection(prev => !prev);
                    } else {
                      handleGenerateTestCases();
                    }
                  }}
                  disabled={!editableCode || isGeneratingTestCases || isLoading}
                  className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${isDark
                    ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30'
                    : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200'}`}
                >
                  {isGeneratingTestCases ? (
                    <div className="w-4 h-4 border-2 border-blue-300/30 border-t-blue-300 rounded-full animate-spin" />
                  ) : (
                    <CheckSquare className="w-4 h-4" />
                  )}
                  {testCases.length > 0
                    ? (showTestCasesSection ? 'Hide Test Cases' : 'Show Test Cases')
                    : 'Generate Test Cases'}
                </button>

                <button
                  onClick={handleRunCode}
                  disabled={!editableCode || isSimulating || isLoading}
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
            </div>

            {renderTestCasesSection()}

            {renderLineageVisualizer()}

            {/* Output Simulation Section */}
            {simulatedData.length > 0 && (
              <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className={`flex items-center gap-2 font-semibold uppercase text-xs tracking-widest ${isDark ? 'text-axis-cream' : 'text-axis-burgundy'}`}>
                  <Database className="w-4 h-4" /> Simulated Output Preview
                </div>

                {/* Controls Row - Table Select, Search and Export dropdown */}
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between w-full">
                  <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full">
                    {/* Table Select Dropdown */}
                    {Object.keys(allTablesData).length > 0 && (
                      <div className="relative flex-1 max-w-xs">
                        <select
                          value={selectedPreviewTable}
                          onChange={(e) => {
                            setSelectedPreviewTable(e.target.value);
                            setSelectedDqTable(e.target.value);
                          }}
                          className={`w-full px-3 py-2 text-sm rounded-xl focus:outline-none focus:ring-2 cursor-pointer transition-all ${isDark
                            ? 'bg-white/10 border border-white/10 text-white focus:ring-axis-red/30'
                            : 'bg-white border border-gray-200 text-gray-700 focus:ring-axis-burgundy/20'}`}
                        >
                          {Object.keys(allTablesData).map((tbl) => (
                            <option key={tbl} value={tbl} className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>
                              {tbl}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

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
            {renderDqInsightsSection()}

            {/* NEW Visualization Section */}
            {simulatedData.length > 0 && (
              <section className="space-y-4 p-6 rounded-2xl border transition-colors duration-400 shadow-sm animate-in fade-in duration-300 bg-gradient-to-r from-axis-burgundy to-axis-red shadow-lg shadow-axis-burgundy/20">
                <div className={`flex items-center gap-2 font-bold uppercase text-xs tracking-widest text-axis-cream`}>
                  <Activity className="w-4 h-4 text-white" /> Visualization Panel
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Select Type Dropdown */}
                  <div className="flex flex-col gap-1.5">
                    <label className={`text-xs font-semibold text-white/60`}>
                      Select Type
                    </label>
                    <select
                      value={chartType}
                      onChange={(e) => setChartType(e.target.value)}
                      className={`px-3.5 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 cursor-pointer transition-all ${isDark
                        ? 'bg-white/10 border border-white/10 text-white focus:ring-axis-red/30'
                        : 'bg-white border border-gray-200 text-gray-700 focus:ring-axis-burgundy/20'}`}
                    >
                      {["Bar Chart", "Column Chart", "Stack Bar", "Line Graph", "Pie Chart", "Donut Chart", "Heat Maps", "Scatter Plots"].map(type => (
                        <option key={type} value={type} className={isDark ? 'bg-axis-burgundy-dark text-white' : 'bg-white text-gray-700'}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Select x-axis Parameter Dropdown */}
                  <div className="relative">
                    <CustomDropdown
                      label="Select x-axis Parameter"
                      options={displayedColumns}
                      value={xAxisParam || 'Choose parameter...'}
                      onChange={(val) => {
                        setXAxisParam(val || '');
                      }}
                    />
                  </div>

                  {/* Select y-axis Parameter Dropdown */}
                  <div className="relative">
                    <CustomDropdown
                      label="Select y-axis Parameter"
                      options={displayedColumns}
                      value={yAxisParam || 'Choose parameter...'}
                      onChange={(val) => {
                        setYAxisParam(val || '');
                      }}
                    />
                  </div>

                  {/* Enter Visualization Subset Size */}
                  <div className="flex flex-col gap-1.5">
                    <label className={`text-xs font-semibold text-white/60`}>
                      Enter Visualization Subset Size
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={simulatedData.length || 100}
                      value={subsetSize}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (isNaN(val)) {
                          setSubsetSize(0);
                        } else {
                          const maxLimit = simulatedData.length;
                          if (maxLimit === 0) {
                            setSubsetSize(0);
                          } else {
                            setSubsetSize(Math.max(1, Math.min(val, maxLimit)));
                          }
                        }
                      }}
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
                    {xAxisParam && yAxisParam && (
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

        {/* Insights & Persona Section */}
        {simulatedData.length > 0 && activeTab === 'cbi' && insightsList.length > 0 && (
          <div className="grid grid-cols-1 gap-6 animate-in fade-in duration-300">
            {/* Business & DQ Insights */}
            <div className={`p-6 rounded-2xl border transition-colors duration-400 space-y-4 ${isDark ? 'bg-axis-burgundy-dark/40 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-800'
              }`}>
              <h3 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${isDark ? 'text-axis-cream' : 'text-axis-burgundy'}`}>
                <Activity className="w-4 h-4 text-axis-red" /> Business & DQ Insights
              </h3>
              <ul className="space-y-3 text-xs leading-relaxed">
                {insightsList.map((insight, idx) => (
                  <li key={idx} className="flex gap-2 items-start">
                    <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${isDark ? 'bg-axis-cream' : 'bg-axis-burgundy'}`} />
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
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

      {/* Checked Output Guardrails Modal */}
      {isOutputGuardrailsModalOpen && outputGuardrailsStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-md rounded-2xl p-6 shadow-2xl relative border ${isDark ? 'bg-axis-burgundy-dark text-white border-white/10' : 'bg-white text-gray-800 border-gray-200'
            }`}>
            <button
              type="button"
              onClick={() => setIsOutputGuardrailsModalOpen(false)}
              className={`absolute top-4 right-4 p-1.5 rounded-lg hover:bg-black/10 transition-colors ${isDark ? 'text-white/60 hover:text-white' : 'text-gray-400 hover:text-gray-600'
                }`}
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className={`text-lg font-bold flex items-center gap-2 mb-2 ${isDark ? 'text-axis-cream' : 'text-axis-burgundy'}`}>
              <Info className="w-5 h-5 text-axis-red animate-pulse" /> Output Guardrails Checklist
            </h3>
            <p className={`text-xs mb-6 ${isDark ? 'text-white/60' : 'text-gray-550'}`}>
              The following guardrails were evaluated for the simulated output table preview.
            </p>

            <div className="space-y-3 mb-6">
              {outputGuardrailsStatus.checked.map((guard, idx) => (
                <div key={idx} className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-colors duration-400 ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-150'
                  }`}>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold">{guard.name}</span>
                    {guard.message && <span className="text-[10px] opacity-65">{guard.message}</span>}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${guard.status === 'Passed'
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-red-500/15 text-red-400'
                    }`}>
                    {guard.status}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsOutputGuardrailsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-axis-red hover:brightness-110 shadow-lg shadow-axis-red/20 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {showToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-axis-burgundy/95 dark:bg-axis-red/95 text-white px-6 py-3 rounded-xl shadow-2xl border border-white/10 flex items-center gap-2 animate-toast-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 animate-bounce" />
          <span className="text-sm font-semibold">Code Copied to Clipboard</span>
        </div>
      )}

      {/* Edit Code Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-4xl rounded-2xl border flex flex-col max-h-[85vh] transition-colors duration-400 ${isDark
            ? 'bg-axis-burgundy-deep border-white/10 text-white'
            : 'bg-white border-gray-200 text-gray-800'}`}>
            {/* Modal Header */}
            <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
              <h3 className="font-bold text-lg">Edit Generated Code</h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className={`p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors ${isDark ? 'text-white/60' : 'text-gray-555'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              <textarea
                value={modalCodeValue}
                onChange={(e) => setModalCodeValue(e.target.value)}
                className={`w-full h-96 p-4 font-mono text-sm rounded-xl focus:outline-none focus:ring-2 transition-all resize-y ${isDark
                  ? 'bg-black/30 border border-white/10 text-white placeholder-white/30 focus:ring-axis-red/30'
                  : 'bg-gray-50 border border-gray-200 text-gray-700 placeholder-gray-400 focus:ring-axis-burgundy/20'}`}
              />
            </div>

            {/* Modal Footer */}
            <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${isDark
                  ? 'border-white/10 hover:bg-white/5 text-white'
                  : 'border-gray-200 hover:bg-gray-50 text-gray-700'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateCode}
                className={`px-5 py-2 rounded-xl text-sm font-bold text-white transition-all hover:brightness-110 ${isDark
                  ? 'bg-gradient-to-r from-axis-red to-axis-burgundy shadow-lg shadow-black/30'
                  : 'bg-gradient-to-r from-axis-burgundy to-axis-red shadow-lg shadow-axis-burgundy/20'}`}
              >
                Update Code
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

//const HashIcon = () => <span className="text-xs text-gray-500">#</span>;

export default MainSection;
