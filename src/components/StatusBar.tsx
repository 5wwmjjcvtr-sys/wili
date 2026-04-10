import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useFavorites } from '@/providers/FavoritesContext';

interface Props {
  updatedAt: string;
  refreshInterval: number;
  onRefresh: () => void;
}

export function StatusBar({ updatedAt, refreshInterval, onRefresh }: Props) {
  const { prefs } = useFavorites();
  const showCurrentTime = prefs.showCurrentTime !== false;
  const showUpdatedAt = prefs.showUpdatedAt !== false;

  const [countdown, setCountdown] = useState(refreshInterval);
  const [currentTime, setCurrentTime] = useState('');

  // Systemzeit (Gerät). Alternativ: Serverzeit aus updatedAt-Offset (siehe unten).
  useEffect(() => {
    const tick = () => {
      setCurrentTime(new Date().toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Serverzeit-Variante (aus API-Zeitstempel):
  // const offsetRef = useRef(0);
  // useEffect(() => {
  //   if (updatedAt) offsetRef.current = new Date(updatedAt).getTime() - Date.now();
  // }, [updatedAt]);
  // tick: new Date(Date.now() + offsetRef.current)

  useEffect(() => {
    if (refreshInterval === 0) return;
    setCountdown(refreshInterval);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          onRefresh();
          return refreshInterval;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [updatedAt, refreshInterval, onRefresh]);

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '--:--:--';
    }
  };

  const handleManualRefresh = () => {
    onRefresh();
    setCountdown(refreshInterval);
  };

  return (
    <div className="grid grid-cols-3 items-center px-4 py-2 text-xs text-muted-foreground bg-background border-b border-border sticky top-[41px] z-30">
      <div>
        {showCurrentTime && currentTime && (
          <span>{currentTime}</span>
        )}
      </div>
      <div className="flex justify-center">
        {showUpdatedAt && (
          <span>aktualisiert: {formatTime(updatedAt)}</span>
        )}
      </div>
      <div className="flex items-center justify-end gap-2">
        <span>{refreshInterval === 0 ? 'manuell' : `Neu in ${countdown} s`}</span>
        <button
          onClick={handleManualRefresh}
          className="p-1 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
          aria-label="Jetzt aktualisieren"
          title="Jetzt aktualisieren"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
