import React from 'react';
import axios from 'axios';
import { ThemeProvider } from './ThemeContext';
import InputSection from './components/InputSection';
import MainSection from './components/MainSection';

//const API_BASE_URL = 'http://localhost:8000';
const API_BASE_URL = 'https://sdlc-assist-app-be.onrender.com';

function App() {
  const [generatedCode, setGeneratedCode] = React.useState<string | null>(null);
  const [dqInsights, setDqInsights] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleGenerate = async (formData: any) => {
    setLoading(true);
    setGeneratedCode(null);
    setDqInsights(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/generate`, formData);
      setGeneratedCode(response.data.generated_code);
      setDqInsights(response.data.dq_insights);
    } catch (error) {
      console.error('Error generating code:', error);
      // Fallback or error message could be added here
      alert('Failed to generate code. Please ensure the backend is running and OpenAI API key is configured.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemeProvider>
      <div className="flex h-screen overflow-hidden">
        <InputSection onGenerate={handleGenerate} isLoading={loading} />
        <MainSection
          code={generatedCode}
          insights={dqInsights}
          isLoading={loading}
        />
      </div>
    </ThemeProvider>
  );
}

export default App;
