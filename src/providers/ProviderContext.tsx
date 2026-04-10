import React, { createContext, useContext, useState, useMemo } from 'react';
import { StationViewProvider } from './types';
import { DirectProvider } from './DirectProvider';
import { ProxyProvider } from './ProxyProvider';

type DataMode = 'direct' | 'proxy';

interface ProviderContextValue {
  mode: DataMode;
  setMode: (mode: DataMode) => void;
  provider: StationViewProvider;
  showDebugUrl: boolean;
  setShowDebugUrl: (v: boolean) => void;
  lastApiUrl: string | null;
  setLastApiUrl: (url: string | null) => void;
}

const ProviderContext = createContext<ProviderContextValue | null>(null);

const directProvider = new DirectProvider();
const proxyProvider = new ProxyProvider();

export function DataProviderWrapper({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<DataMode>('direct');
  const [showDebugUrl, setShowDebugUrl] = useState(true);
  const [lastApiUrl, setLastApiUrl] = useState<string | null>(null);
  const provider = useMemo(() => (mode === 'direct' ? directProvider : proxyProvider), [mode]);

  return (
    <ProviderContext.Provider value={{ mode, setMode, provider, showDebugUrl, setShowDebugUrl, lastApiUrl, setLastApiUrl }}>
      {children}
    </ProviderContext.Provider>
  );
}

export function useDataProvider() {
  const ctx = useContext(ProviderContext);
  if (!ctx) throw new Error('useDataProvider must be within DataProviderWrapper');
  return ctx;
}
