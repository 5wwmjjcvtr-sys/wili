import { useDataProvider } from '@/providers/ProviderContext';
import { useFavorites } from '@/providers/FavoritesContext';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function SettingsView() {
  const { mode, setMode, showDebugUrl, setShowDebugUrl } = useDataProvider();
  const { prefs, setDepCount, setRefreshInterval } = useFavorites();
  const depCount = prefs.depCount ?? 3;
  const refreshSec = prefs.refreshInterval ?? 30;

  return (
    <div className="flex-1 px-4 py-4 space-y-6">
      <h2 className="text-sm font-semibold text-foreground">Einstellungen</h2>

      {/* Departure count */}
      <div className="flex items-center justify-between">
        <Label htmlFor="dep-count" className="text-sm">Angezeigte Abfahrten</Label>
        <Select value={String(depCount)} onValueChange={(v) => setDepCount(parseInt(v, 10))}>
          <SelectTrigger className="w-20 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5, 6, 8, 10].map(n => (
              <SelectItem key={n} value={String(n)}>{n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Refresh interval */}
      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor="refresh-interval" className="text-sm">Aktualisierung</Label>
          <p className="text-xs text-muted-foreground">Sekunden zwischen Daten-Refresh</p>
        </div>
        <Select value={String(refreshSec)} onValueChange={(v) => setRefreshInterval(parseInt(v, 10))}>
          <SelectTrigger className="w-20 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[10, 15, 20, 30, 45, 60, 90, 120].map(n => (
              <SelectItem key={n} value={String(n)}>{n}s</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm">Datenquelle</Label>
          <p className="text-xs text-muted-foreground">Direkt = Wiener Linien API, Proxy = Edge Function</p>
        </div>
        <Select value={mode} onValueChange={(v) => setMode(v as 'direct' | 'proxy')}>
          <SelectTrigger className="w-24 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="proxy">Proxy</SelectItem>
            <SelectItem value="direct">Direkt</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Debug URL toggle */}
      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor="debug-url" className="text-sm">API-URL anzeigen</Label>
          <p className="text-xs text-muted-foreground">Zeigt den HTTP-Link der API-Abfrage</p>
        </div>
        <Switch id="debug-url" checked={showDebugUrl} onCheckedChange={setShowDebugUrl} />
      </div>
    </div>
  );
}
