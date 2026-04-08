import { useState, useCallback, useEffect, useRef } from 'react';
import { DataProviderWrapper, useDataProvider } from '@/providers/ProviderContext';
import { FavoritesProvider, useFavorites } from '@/providers/FavoritesContext';
import { StationSearch } from '@/components/StationSearch';
import { StatusBar } from '@/components/StatusBar';
import { AlertsSection } from '@/components/AlertsSection';
import { LineGroupCard } from '@/components/LineGroupCard';
import { FavoritesView } from '@/components/FavoritesView';
import { SettingsView } from '@/components/SettingsView';
import { SearchResult, StationView } from '@/types/station';
import { fetchScheduleBounds, mergeScheduleBounds } from '@/lib/schedule-bounds';
import { Star, Search, Settings } from 'lucide-react';

type AppTab = 'search' | 'favorites' | 'settings';

function MonitorApp() {
  const { provider, mode, showDebugUrl, lastApiUrl, setLastApiUrl } = useDataProvider();
  const { refreshInterval } = useFavorites();
  const [selectedStop, setSelectedStop] = useState<SearchResult | null>(null);
  const [stationView, setStationView] = useState<StationView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('favorites');
  const stopRef = useRef<string | null>(null);
  const boundsRef = useRef<any[]>([]);

  const fetchStation = useCallback(async (stopId: string) => {
    setLoading(true);
    setError(null);
    try {
      if (mode === 'direct') {
        const { loadRblMapping } = await import('@/lib/stops-loader');
        const rblMap = await loadRblMapping();
        const rbls = rblMap.get(stopId) ?? [];
        if (rbls.length > 0) {
          const params = rbls.map(r => `stopId=${encodeURIComponent(r)}`).join('&');
          setLastApiUrl(`https://www.wienerlinien.at/ogd_realtime/monitor?${params}&activateTrafficInfo=stoerungkurz&activateTrafficInfo=aufzugsinfo`);
        } else {
          setLastApiUrl(`Proxy-Fallback (keine RBL für DIVA ${stopId})`);
        }
      } else {
        setLastApiUrl(`POST station-view { "stopId": "${stopId}" }`);
      }

      const view = await provider.getStationView(stopId);
      if (stopRef.current === stopId) {
        const merged = boundsRef.current.length > 0
          ? mergeScheduleBounds(view, boundsRef.current)
          : view;
        setStationView(merged);
      }
    } catch (e: any) {
      if (stopRef.current === stopId) {
        setError(e.message || 'Fehler beim Laden der Abfahrten');
      }
    } finally {
      setLoading(false);
    }
  }, [provider, mode, setLastApiUrl]);

  const handleSelect = useCallback((stop: SearchResult) => {
    setSelectedStop(stop);
    stopRef.current = stop.stopId;
    boundsRef.current = [];
    setStationView(null);
    fetchStation(stop.stopId);
    fetchScheduleBounds(stop.stopId).then((bounds) => {
      boundsRef.current = bounds;
      setStationView((prev) => prev ? mergeScheduleBounds(prev, bounds) : prev);
    });
  }, [fetchStation]);

  const handleRefresh = useCallback(() => {
    if (stopRef.current) {
      fetchStation(stopRef.current);
    }
  }, [fetchStation]);

  useEffect(() => {
    if (stopRef.current) {
      fetchStation(stopRef.current);
    }
  }, [provider, fetchStation]);

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-lg mx-auto">
      {/* Sticky tab bar */}
      <div className="flex border-b border-border sticky top-0 z-40 bg-background">
        <button
          onClick={() => setActiveTab('favorites')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'favorites'
              ? 'text-foreground border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Star className="h-4 w-4" />
          Favoriten
        </button>
        <button
          onClick={() => setActiveTab('search')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'search'
              ? 'text-foreground border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Search className="h-4 w-4" />
          Station
        </button>
        <button
          onClick={() => setActiveTab(activeTab === 'settings' ? 'favorites' : 'settings')}
          className={`flex items-center justify-center px-3 py-2.5 transition-colors ${
            activeTab === 'settings'
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-label="Einstellungen"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>

      {activeTab === 'search' && (
        <>
          {showDebugUrl && lastApiUrl && (
            <div className="px-4 py-1.5 bg-muted/30 border-b border-border">
              {lastApiUrl.startsWith('http') ? (
                <a
                  href={lastApiUrl.split(/\s+/)[0]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-mono text-primary underline break-all leading-tight block"
                >
                  {lastApiUrl}
                </a>
              ) : (
                <p className="text-[10px] font-mono text-muted-foreground break-all leading-tight">
                  {lastApiUrl}
                </p>
              )}
            </div>
          )}
          <StationSearch onSelect={handleSelect} selectedStation={selectedStop?.name} />

          {stationView && (
            <>
              <StatusBar
                updatedAt={stationView.updatedAt}
                refreshInterval={refreshInterval}
                onRefresh={handleRefresh}
              />
              {stationView.stationInfrastructure?.hasElevatorIssue && (
                <div className="px-4 py-1.5">
                  <div className="flex items-center gap-2 rounded-md border border-[hsl(var(--wl-alert)/0.4)] bg-[hsl(var(--wl-alert)/0.08)] px-3 py-2">
                    <span className="text-base">🛗</span>
                    <span className="text-sm font-medium text-foreground">Aufzugsstörung</span>
                  </div>
                </div>
              )}
              <AlertsSection alerts={stationView.alerts} />
            </>
          )}

          {loading && !stationView && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          )}

          {error && (
            <div className="px-4 py-3">
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            </div>
          )}

          {stationView && (
            <div className="px-4 py-3 space-y-3 flex-1">
              {stationView.lineGroups.length > 0 ? (
                stationView.lineGroups.map((lg) => (
                  <LineGroupCard
                    key={`${lg.type}_${lg.name}`}
                    lineGroup={lg}
                    stationStopId={stationView.station.stopId}
                    stationTitle={stationView.station.title}
                  />
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8 text-sm">
                  Keine Abfahrten verfügbar
                </p>
              )}
            </div>
          )}
        </>
      )}

      {activeTab === 'favorites' && <FavoritesView />}
      {activeTab === 'settings' && <SettingsView />}
    </div>
  );
}

export default function Index() {
  return (
    <DataProviderWrapper>
      <FavoritesProvider>
        <MonitorApp />
      </FavoritesProvider>
    </DataProviderWrapper>
  );
}
