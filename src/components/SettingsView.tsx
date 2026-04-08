import { useDataProvider } from '@/providers/ProviderContext';
import { useFavorites } from '@/providers/FavoritesContext';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function SettingsView() {
  const { mode, setMode, showDebugUrl, setShowDebugUrl } = useDataProvider();
  const { prefs, setDepCount, setRefreshInterval, setThemePref, setShowFirstDep, setShowLastDep } = useFavorites();
  const depCount = prefs.depCount ?? 3;
  const refreshSec = prefs.refreshInterval ?? 30;
  const theme = prefs.theme ?? 'system';
  const showFirstDep = prefs.showFirstDep !== false;
  const showLastDep = prefs.showLastDep !== false;

  return (
    <div className="flex-1 px-4 py-4 space-y-6">
      <h2 className="text-sm font-semibold text-foreground">Einstellungen</h2>

      {/* Departure count */}
      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor="dep-count" className="text-sm">Angezeigte Abfahrten</Label>
          <p className="text-xs text-muted-foreground">Maximal 70 Minuten</p>
        </div>
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

      {/* First / Last departure toggles */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox id="show-first" checked={showFirstDep} onCheckedChange={(v) => setShowFirstDep(!!v)} />
          <Label htmlFor="show-first" className="text-sm">Erste Fahrt anzeigen</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="show-last" checked={showLastDep} onCheckedChange={(v) => setShowLastDep(!!v)} />
          <Label htmlFor="show-last" className="text-sm">Letzte Fahrt anzeigen</Label>
        </div>
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
            {[5, 10, 15, 20, 30, 45, 60, 90, 120].map(n => (
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

      {/* Theme */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm">Darstellung</Label>
          <p className="text-xs text-muted-foreground">Hell, Dunkel oder Systemeinstellung</p>
        </div>
        <Select value={theme} onValueChange={(v) => setThemePref(v as 'light' | 'dark' | 'system')}>
          <SelectTrigger className="w-28 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="system">System</SelectItem>
            <SelectItem value="light">Hell</SelectItem>
            <SelectItem value="dark">Dunkel</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
