import React, { createContext, useContext, useState, useMemo } from 'react';
import { StationViewProvider } from './types';
import { DirectProvider } from './DirectProvider';
import { ProxyProvider } from './ProxyProvider';

type DataMode = 'direct' | 'proxy';

interface ProviderContextValue {
  mode: DataMode;
  setMode: (mode: DataMode) => void;
  provider: StationViewProvider;
}

const ProviderContext = createContext<ProviderContextValue | null>(null);

const directProvider = new DirectProvider();
const proxyProvider = new ProxyProvider();

export function DataProviderWrapper({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<DataMode>('direct');
  const provider = useMemo(() => (mode === 'direct' ? directProvider : proxyProvider), [mode]);

  return (
    <ProviderContext.Provider value={{ mode, setMode, provider }}>
      {children}
    </ProviderContext.Provider>
  );
}

export function useDataProvider() {
  const ctx = useContext(ProviderContext);
  if (!ctx) throw new Error('useDataProvider must be within DataProviderWrapper');
  return ctx;
}
