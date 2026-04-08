import { useState, useCallback, useEffect, useRef } from 'react';
import { DataProviderWrapper, useDataProvider } from '@/providers/ProviderContext';
import { AppHeader } from '@/components/AppHeader';
import { StationSearch } from '@/components/StationSearch';
import { StatusBar } from '@/components/StatusBar';
import { AlertsSection } from '@/components/AlertsSection';
import { LineGroupCard } from '@/components/LineGroupCard';
import { SearchResult, StationView } from '@/types/station';
import { fetchScheduleBounds, mergeScheduleBounds } from '@/lib/schedule-bounds';

const REFRESH_INTERVAL = 30;

function MonitorApp() {
  const { provider, mode, showDebugUrl, lastApiUrl, setLastApiUrl } = useDataProvider();
  const [selectedStop, setSelectedStop] = useState<SearchResult | null>(null);
  const [stationView, setStationView] = useState<StationView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef<string | null>(null);
  const boundsRef = useRef<any[]>([]);

  const fetchStation = useCallback(async (stopId: string) => {
    setLoading(true);
    setError(null);
    try {
      // Build debug URL
      if (mode === 'direct') {
        const { loadRblMapping } = await import('@/lib/stops-loader');
        const rblMap = await loadRblMapping();
        const rbls = rblMap.get(stopId) ?? [];
        if (rbls.length > 0) {
          const params = rbls.map(r => `stopId=${encodeURIComponent(r)}`).join('&');
          setLastApiUrl(`https://www.wienerlinien.at/ogd_realtime/monitor?${params}&activateTrafficInfo=stoerungkurz`);
        } else {
          setLastApiUrl(`Proxy-Fallback (keine RBL für DIVA ${stopId})`);
        }
      } else {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        setLastApiUrl(`${supabaseUrl}/functions/v1/station-view  POST { "stopId": "${stopId}" }`);
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
    // Fetch schedule bounds once per station change (non-blocking)
    fetchScheduleBounds(stop.stopId).then((bounds) => {
      boundsRef.current = bounds;
      // Re-merge if we already have a station view
      setStationView((prev) => prev ? mergeScheduleBounds(prev, bounds) : prev);
    });
  }, [fetchStation]);

  const handleRefresh = useCallback(() => {
    if (stopRef.current) {
      fetchStation(stopRef.current);
    }
  }, [fetchStation]);

  // Re-fetch when provider changes
  useEffect(() => {
    if (stopRef.current) {
      fetchStation(stopRef.current);
    }
  }, [provider, fetchStation]);

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-lg mx-auto">
      <AppHeader />
      {showDebugUrl && lastApiUrl && (
        <div className="px-4 py-1.5 bg-muted/30 border-b border-border">
          <p className="text-[10px] font-mono text-muted-foreground break-all leading-tight">
            {lastApiUrl}
          </p>
        </div>
      )}
      <StationSearch onSelect={handleSelect} selectedStation={selectedStop?.name} />

      {stationView && (
        <>
          <StatusBar
            updatedAt={stationView.updatedAt}
            refreshInterval={REFRESH_INTERVAL}
            onRefresh={handleRefresh}
          />
          <AlertsSection alerts={stationView.alerts} />
        </>
      )}

      {/* Loading state */}
      {loading && !stationView && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="px-4 py-3">
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        </div>
      )}

      {/* Departures */}
      {stationView && (
        <div className="px-4 py-3 space-y-3 flex-1">
          {stationView.lineGroups.length > 0 ? (
            stationView.lineGroups.map((lg) => (
              <LineGroupCard key={`${lg.type}_${lg.name}`} lineGroup={lg} />
            ))
          ) : (
            <p className="text-center text-muted-foreground py-8 text-sm">
              Keine Abfahrten verfügbar
            </p>
          )}

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground py-2">
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-[hsl(var(--wl-realtime))]" />
              Echtzeit
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-[hsl(var(--wl-schedule))]" />
              Fahrplan
            </span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!selectedStop && !loading && (
        <div className="flex-1 flex items-center justify-center px-4">
          <p className="text-muted-foreground text-sm text-center">
            Gib eine Wiener-Linien-Station ein, um die nächsten Abfahrten zu sehen.
          </p>
        </div>
      )}
    </div>
  );
}

export default function Index() {
  return (
    <DataProviderWrapper>
      <MonitorApp />
    </DataProviderWrapper>
  );
}
