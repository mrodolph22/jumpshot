
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface ApiKeyContextType {
  apiKey: string | null;
  saveKey: (key: string) => void;
  clearKey: () => void;
}

const ApiKeyContext = createContext<ApiKeyContextType | undefined>(undefined);

export const ApiKeyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [apiKey, setApiKey] = useState<string | null>(() => localStorage.getItem('odds_api_key'));

  const saveKey = useCallback((key: string) => {
    localStorage.setItem('odds_api_key', key);
    setApiKey(key);
  }, []);

  const clearKey = useCallback(() => {
    localStorage.removeItem('odds_api_key');
    setApiKey(null);
  }, []);

  return (
    <ApiKeyContext.Provider value={{ apiKey, saveKey, clearKey }}>
      {children}
    </ApiKeyContext.Provider>
  );
};

export const useApiKey = () => {
  const context = useContext(ApiKeyContext);
  if (!context) throw new Error('useApiKey must be used within ApiKeyProvider');
  return context;
};
