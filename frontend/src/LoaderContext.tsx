import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import GlobalLoader from './components/GlobalLoader';

interface LoaderContextType {
  showLoader: () => void;
  hideLoader: () => void;
}

const LoaderContext = createContext<LoaderContextType | null>(null);

export const useLoader = () => {
  const context = useContext(LoaderContext);
  if (!context) {
    throw new Error('useLoader must be used within a LoaderProvider');
  }
  return context;
};

// Module-level state tracking active requests
let activeRequestsCount = 0;
const listeners = new Set<(count: number) => void>();

const notifyListeners = () => {
  listeners.forEach((listener) => listener(activeRequestsCount));
};

// Register Axios interceptors immediately at module load time
axios.interceptors.request.use(
  (config) => {
    activeRequestsCount++;
    notifyListeners();
    return config;
  },
  (error) => {
    activeRequestsCount = Math.max(0, activeRequestsCount - 1);
    notifyListeners();
    return Promise.reject(error);
  }
);

axios.interceptors.response.use(
  (response) => {
    activeRequestsCount = Math.max(0, activeRequestsCount - 1);
    notifyListeners();
    return response;
  },
  (error) => {
    activeRequestsCount = Math.max(0, activeRequestsCount - 1);
    notifyListeners();
    return Promise.reject(error);
  }
);

// Override native fetch immediately at module load time
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  activeRequestsCount++;
  notifyListeners();
  try {
    const response = await originalFetch(...args);
    return response;
  } catch (error) {
    throw error;
  } finally {
    activeRequestsCount = Math.max(0, activeRequestsCount - 1);
    notifyListeners();
  }
};

export const LoaderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeRequests, setActiveRequests] = useState(activeRequestsCount);

  useEffect(() => {
    const handleCountChange = (count: number) => {
      setActiveRequests(count);
    };
    listeners.add(handleCountChange);
    // Sync initial state if it changed between module load and mount
    setActiveRequests(activeRequestsCount);

    return () => {
      listeners.delete(handleCountChange);
    };
  }, []);

  const showLoader = () => {
    activeRequestsCount++;
    notifyListeners();
  };

  const hideLoader = () => {
    activeRequestsCount = Math.max(0, activeRequestsCount - 1);
    notifyListeners();
  };

  const isLoading = activeRequests > 0;

  return (
    <LoaderContext.Provider value={{ showLoader, hideLoader }}>
      {children}
      {isLoading && <GlobalLoader />}
    </LoaderContext.Provider>
  );
};

