import { useState, useCallback, useEffect, useRef } from 'react';
import { DataProviderWrapper, useDataProvider } from '@/providers/ProviderContext';
import { AppHeader } from '@/components/AppHeader';
import { StationSearch } from '@/components/StationSearch';
import { StatusBar } from '@/components/StatusBar';
import { AlertsSection } from '@/components/AlertsSection';
import { LineGroupCard } from '@/components/LineGroupCard';
import { SearchResult, StationView } from '@/types/station';

const REFRESH_INTERVAL = 30;

function MonitorApp() {
  const { provider } = useDataProvider();
  const [selectedStop, setSelectedStop] = useState<SearchResult | null>(null);
  const [stationView, setStationView] = useState<StationView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef<string | null>(null);

  const fetchStation = useCallback(async (stopId: string) => {
    setLoading(true);
    setError(null);
    try {
      const view = await provider.getStationView(stopId);
      // Only update if still the same station
      if (stopRef.current === stopId) {
        setStationView(view);
      }
    } catch (e: any) {
      if (stopRef.current === stopId) {
        setError(e.message || 'Fehler beim Laden der Abfahrten');
      }
    } finally {
      setLoading(false);
    }
  }, [provider]);

  const handleSelect = useCallback((stop: SearchResult) => {
    setSelectedStop(stop);
    stopRef.current = stop.stopId;
    setStationView(null);
    fetchStation(stop.stopId);
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
