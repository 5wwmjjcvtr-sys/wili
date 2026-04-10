import { useDataProvider } from '@/providers/ProviderContext';
import { useFavorites } from '@/providers/FavoritesContext';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

export function SettingsView({ onEditFavorites }: { onEditFavorites: () => void }) {
  const { mode, setMode, showDebugUrl, setShowDebugUrl } = useDataProvider();
  const { prefs, setDepCount, setRefreshInterval, setThemePref, setShowFirstDep, setShowLastDep, setShowTime, setShowTimeDiff, setShowCurrentTime, setShowUpdatedAt, setScheduleBoundsSource, scheduleBoundsSource, editMode, setEditMode, hasFavorites } = useFavorites();
  const depCount = prefs.depCount ?? 3;
  const refreshSec = prefs.refreshInterval ?? 30;
  const theme = prefs.theme ?? 'system';
  const showFirstDep = prefs.showFirstDep !== false;
  const showLastDep = prefs.showLastDep !== false;
  const showTime = prefs.showTime !== false;
  const showTimeDiff = prefs.showTimeDiff !== false;
  const showCurrentTime = prefs.showCurrentTime !== false;
  const showUpdatedAt = prefs.showUpdatedAt !== false;

  return (
    <div className="flex-1 px-4 py-4 space-y-6">
      <h2 className="text-sm font-semibold text-foreground">Einstellungen</h2>

      {/* Favorites edit */}
      {hasFavorites && (
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm">Favoriten bearbeiten</Label>
            <p className="text-xs text-muted-foreground">Reihenfolge ändern, Einträge entfernen</p>
          </div>
          <Button
            variant={editMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setEditMode(!editMode); if (!editMode) onEditFavorites(); }}
          >
            {editMode ? 'Fertig' : 'Bearbeiten'}
          </Button>
        </div>
      )}

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
            <SelectItem value="0">manuell</SelectItem>
            {[5, 10, 15, 20, 30, 45, 60, 90, 120].map(n => (
              <SelectItem key={n} value={String(n)}>{n}s</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
            {[1, 2, 3, 4, 5, 6].map(n => (
              <SelectItem key={n} value={String(n)}>{n}</SelectItem>
            ))}
            <SelectItem value="99">Alle</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Display toggles */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="show-first" className="text-sm">Erste Fahrt anzeigen</Label>
          <Switch id="show-first" checked={showFirstDep} onCheckedChange={setShowFirstDep} />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="show-last" className="text-sm">Letzte Fahrt anzeigen</Label>
          <Switch id="show-last" checked={showLastDep} onCheckedChange={setShowLastDep} />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="show-time" className="text-sm">Prognoseuhrzeit anzeigen</Label>
          <Switch id="show-time" checked={showTime} onCheckedChange={setShowTime} />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="show-time-diff" className="text-sm">Abweichung zur Planzeit anzeigen</Label>
          <Switch id="show-time-diff" checked={showTimeDiff} onCheckedChange={setShowTimeDiff} />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="show-current-time" className="text-sm">Aktuelle Uhrzeit anzeigen</Label>
          <Switch id="show-current-time" checked={showCurrentTime} onCheckedChange={setShowCurrentTime} />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="show-updated-at" className="text-sm">Aktualisierungszeit anzeigen</Label>
          <Switch id="show-updated-at" checked={showUpdatedAt} onCheckedChange={setShowUpdatedAt} />
        </div>
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

      {/* Schedule bounds source */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm">Erste/Letzte Fahrt</Label>
          <p className="text-xs text-muted-foreground">Statisch = lokale JSON-Datei, Supabase = Clouddatenbank</p>
        </div>
        <Select value={scheduleBoundsSource} onValueChange={(v) => setScheduleBoundsSource(v as 'supabase' | 'static')}>
          <SelectTrigger className="w-28 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="static">Statisch</SelectItem>
            <SelectItem value="supabase">Supabase</SelectItem>
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

      {/* Legend */}
      <div className="pt-2 border-t border-border">
        <Label className="text-sm">Legende</Label>
        <div className="flex flex-col gap-2 mt-2">
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-block w-2 h-2 rounded-full bg-[hsl(var(--wl-realtime))]" />
            Echtzeit – Daten kommen live vom Fahrzeug
          </span>
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-block w-2 h-2 rounded-full bg-[hsl(var(--wl-schedule))]" />
            Fahrplan – planmäßige Abfahrtszeit
          </span>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="pt-2 border-t border-border">
        <Label className="text-sm">Disclaimer</Label>
        <div className="mt-2 space-y-2 text-xs text-muted-foreground">
          <p>
            Datenquelle: API von{' '}
            <a href="https://www.wienerlinien.at" target="_blank" rel="noopener noreferrer"
              className="underline hover:text-foreground">
              www.wienerlinien.at
            </a>
            . Alle Angaben ohne Gewähr. Nutzung nur nach Maßgabe der Bedingungen der Wiener Linien.
            Abfahrtszeiten und sonstige Anzeigen können unvollständig, verspätet oder fehlerhaft sein.
            Fehler und Änderungen vorbehalten.
          </p>
          <p>
            Die angezeigten Zeiten werden laufend anhand der von den Wiener Linien bereitgestellten
            Daten aktualisiert und können deutlich schwanken. Abweichungen zur tatsächlichen Situation
            sind jederzeit möglich.
          </p>
        </div>
      </div>
    </div>
  );
}
