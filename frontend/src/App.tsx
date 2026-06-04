import React from 'react';
import axios from 'axios';
import { ThemeProvider } from './ThemeContext';
import InputSection from './components/InputSection';
import MainSection from './components/MainSection';
import LoginPage from './components/LoginPage';
import CreateTablePage from './components/CreateTablePage';

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8000'
  : 'https://sdlc-assist-app-be.onrender.com';

function App() {
  const [user, setUser] = React.useState<{ userId: string; role: string } | null>(null);
  const [generatedCode, setGeneratedCode] = React.useState<string | null>(null);
  const [dqInsights, setDqInsights] = React.useState<any | null>(null);
  const [lastFormData, setLastFormData] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [generationTokens, setGenerationTokens] = React.useState<{ prompt_tokens: number, completion_tokens: number } | null>(null);
  const [currentPage, setCurrentPage] = React.useState<'main' | 'create-table'>('main');

  React.useEffect(() => {
    const storedUser = localStorage.getItem('sdlc_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem('sdlc_user');
      }
    }
  }, []);

  const handleLoginSuccess = (userId: string, role: string) => {
    const newUser = { userId, role };
    setUser(newUser);
    localStorage.setItem('sdlc_user', JSON.stringify(newUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('sdlc_user');
    setGeneratedCode(null);
    setDqInsights(null);
    setGenerationTokens(null);
    setLastFormData(null);
    setCurrentPage('main');
  };

  const handleGenerate = async (formData: any) => {
    setLoading(true);
    setGeneratedCode(null);
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
      setDqInsights(response.data.dq_insights);
      setGenerationTokens({
        prompt_tokens: response.data.prompt_tokens || 0,
        completion_tokens: response.data.completion_tokens || 0
      });
    } catch (error) {
      console.error('Error generating code:', error);
      alert('Failed to generate code. Please ensure the backend is running and LLM API key is configured.');
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
      {currentPage === 'create-table' ? (
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
          />
          <MainSection
            code={generatedCode}
            insights={dqInsights}
            isLoading={loading}
            apiBaseUrl={API_BASE_URL}
            formData={lastFormData}
            generationTokens={generationTokens}
            user={user}
          />
        </div>
      )}
    </ThemeProvider>
  );
}

export default App;
