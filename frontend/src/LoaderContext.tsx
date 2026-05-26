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

export const LoaderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeRequests, setActiveRequests] = useState(0);

  useEffect(() => {
    // 1. Axios Interceptors
    const reqInterceptor = axios.interceptors.request.use(
      (config) => {
        setActiveRequests((prev) => prev + 1);
        return config;
      },
      (error) => {
        setActiveRequests((prev) => Math.max(0, prev - 1));
        return Promise.reject(error);
      }
    );

    const resInterceptor = axios.interceptors.response.use(
      (response) => {
        setActiveRequests((prev) => Math.max(0, prev - 1));
        return response;
      },
      (error) => {
        setActiveRequests((prev) => Math.max(0, prev - 1));
        return Promise.reject(error);
      }
    );

    // 2. Window Fetch Interceptor
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      setActiveRequests((prev) => prev + 1);
      try {
        const response = await originalFetch(...args);
        return response;
      } catch (error) {
        throw error;
      } finally {
        setActiveRequests((prev) => Math.max(0, prev - 1));
      }
    };

    // Cleanup interceptors on unmount
    return () => {
      axios.interceptors.request.eject(reqInterceptor);
      axios.interceptors.response.eject(resInterceptor);
      window.fetch = originalFetch;
    };
  }, []);

  const showLoader = () => setActiveRequests((prev) => prev + 1);
  const hideLoader = () => setActiveRequests((prev) => Math.max(0, prev - 1));

  const isLoading = activeRequests > 0;

  return (
    <LoaderContext.Provider value={{ showLoader, hideLoader }}>
      {children}
      {isLoading && <GlobalLoader />}
    </LoaderContext.Provider>
  );
};
