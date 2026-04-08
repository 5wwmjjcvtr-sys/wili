import { Switch } from '@/components/ui/switch';
import { useDataProvider } from '@/providers/ProviderContext';

export function AppHeader() {
  const { mode, setMode, showDebugUrl, setShowDebugUrl } = useDataProvider();

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
      <h1 className="text-lg font-bold text-foreground tracking-tight">WL Monitor</h1>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
          <Switch
            checked={showDebugUrl}
            onCheckedChange={setShowDebugUrl}
            className="scale-75"
            aria-label="API-URL anzeigen"
          />
          <span>URL</span>
        </label>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={mode === 'direct' ? 'font-semibold text-foreground' : ''}>Direkt</span>
          <Switch
            checked={mode === 'proxy'}
            onCheckedChange={(checked) => setMode(checked ? 'proxy' : 'direct')}
            aria-label="Datenmodus umschalten"
          />
          <span className={mode === 'proxy' ? 'font-semibold text-foreground' : ''}>Proxy</span>
        </div>
      </div>
    </header>
  );
}
