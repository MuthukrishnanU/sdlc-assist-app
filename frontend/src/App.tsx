import React from 'react';
import axios from 'axios';
import { ThemeProvider } from './ThemeContext';
import InputSection from './components/InputSection';
import MainSection from './components/MainSection';
import LoginPage from './pages/Login';
import CreateTablePage from './pages/CreateTable';
import AdminDashboard from './pages/AdminDashboard';
import AddNewPiiDataPage from './pages/AddNewPiiData';

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8000'
  : 'https://muthuhf3-sdlcassistbe.hf.space';

function App() {
  const [user, setUser] = React.useState<{ userId: string; role: string; canView: string; domain: string[] } | null>(null);
  const [generatedCode, setGeneratedCode] = React.useState<string | null>(null);
  const [flowExplanation, setFlowExplanation] = React.useState<string | null>(null);
  const [dqInsights, setDqInsights] = React.useState<any | null>(null);
  const [lastFormData, setLastFormData] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [generationTokens, setGenerationTokens] = React.useState<{ prompt_tokens: number, completion_tokens: number } | null>(null);
  const [currentPage, setCurrentPage] = React.useState<'main' | 'create-table' | 'add-new-pii'>('main');
  const [activeTab, setActiveTab] = React.useState<'sdlc' | 'cbi'>('sdlc');

  React.useEffect(() => {
    const storedUser = localStorage.getItem('sdlc_user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
        if (parsed.canView === 'cbi') {
          setActiveTab('cbi');
        } else {
          setActiveTab('sdlc');
        }
      } catch (e) {
        localStorage.removeItem('sdlc_user');
      }
    }
  }, []);

  React.useEffect(() => {
    setGeneratedCode(null);
    setFlowExplanation(null);
    setDqInsights(null);
    setGenerationTokens(null);
    setLastFormData(null);
  }, [activeTab]);

  const handleLoginSuccess = (userId: string, role: string, canView: string, domain: string[]) => {
    const newUser = { userId, role, canView, domain };
    setUser(newUser);
    localStorage.setItem('sdlc_user', JSON.stringify(newUser));
    if (canView === 'cbi') {
      setActiveTab('cbi');
    } else {
      setActiveTab('sdlc');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('sdlc_user');
    setGeneratedCode(null);
    setFlowExplanation(null);
    setDqInsights(null);
    setGenerationTokens(null);
    setLastFormData(null);
    setCurrentPage('main');
    setActiveTab('sdlc');
  };

  const handleGenerate = async (formData: any) => {
    setLoading(true);
    setGeneratedCode(null);
    setFlowExplanation(null);
    setDqInsights(null);
    setGenerationTokens(null);
    setLastFormData(formData);

    try {
      const response = await axios.post(`${API_BASE_URL}/generate`, {
        ...formData,
        role: user?.role,
        userId: user?.userId
      });
      setGeneratedCode(response.data.generated_code);
      setFlowExplanation(response.data.flow_explanation);
      setDqInsights(response.data.dq_insights);
      setGenerationTokens({
        prompt_tokens: response.data.prompt_tokens || 0,
        completion_tokens: response.data.completion_tokens || 0
      });
      
      // Update form data with detected tables and columns if returned by the API
      setLastFormData((prev: any) => ({
        ...prev,
        tables: response.data.detected_tables || prev?.tables || [],
        columns: response.data.detected_columns || prev?.columns || []
      }));
    } catch (error: any) {
      console.error('Error generating code:', error);
      let errMsg = 'Failed to generate code. Please ensure the backend is running and LLM API key is configured.';
      if (error.response?.data?.detail) {
        if (typeof error.response.data.detail === 'string') {
          errMsg = error.response.data.detail;
        } else if (Array.isArray(error.response.data.detail)) {
          errMsg = error.response.data.detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
        } else {
          errMsg = typeof error.response.data.detail === 'object' 
            ? (error.response.data.detail.message || JSON.stringify(error.response.data.detail))
            : String(error.response.data.detail);
        }
      }
      alert(errMsg);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <ThemeProvider>
        <LoginPage onLoginSuccess={handleLoginSuccess} apiBaseUrl={API_BASE_URL} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      {user.userId === 'admin' ? (
        currentPage === 'add-new-pii' ? (
          <AddNewPiiDataPage
            user={user}
            onBack={() => setCurrentPage('main')}
            apiBaseUrl={API_BASE_URL}
            onLogout={handleLogout}
          />
        ) : (
          <AdminDashboard
            user={user}
            onLogout={handleLogout}
            apiBaseUrl={API_BASE_URL}
            onNavigateToPii={() => setCurrentPage('add-new-pii')}
          />
        )
      ) : currentPage === 'create-table' ? (
        <CreateTablePage
          user={user}
          onBack={() => setCurrentPage('main')}
          apiBaseUrl={API_BASE_URL}
        />
      ) : (
        <div className="flex h-screen overflow-hidden">
          <InputSection
            onGenerate={handleGenerate}
            isLoading={loading}
            apiBaseUrl={API_BASE_URL}
            user={user}
            onLogout={handleLogout}
            onCreateNewTable={() => setCurrentPage('create-table')}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
          <MainSection
            code={generatedCode}
            flowExplanation={flowExplanation}
            insights={dqInsights}
            isLoading={loading}
            apiBaseUrl={API_BASE_URL}
            formData={lastFormData}
            generationTokens={generationTokens}
            user={user}
            activeTab={activeTab}
          />
        </div>
      )}
    </ThemeProvider>
  );
}

export default App;
