import React from 'react';
import InputSection from '../components/InputSection';
import MainSection from '../components/MainSection';

interface HomeProps {
  user: { userId: string; role: string; canView: string; domain: string[] };
  loading: boolean;
  API_BASE_URL: string;
  generatedCode: string | null;
  flowExplanation: string | null;
  dqInsights: any | null;
  lastFormData: any | null;
  generationTokens: any | null;
  activeTab: 'sdlc' | 'cbi';
  setActiveTab: (tab: 'sdlc' | 'cbi') => void;
  handleGenerate: (formData: any) => void;
  handleLogout: () => void;
  setCurrentPage: (page: 'main' | 'create-table') => void;
}

const Home: React.FC<HomeProps> = ({
  user,
  loading,
  API_BASE_URL,
  generatedCode,
  flowExplanation,
  dqInsights,
  lastFormData,
  generationTokens,
  activeTab,
  setActiveTab,
  handleGenerate,
  handleLogout,
  setCurrentPage
}) => {
  return (
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
  );
};

export default Home;
