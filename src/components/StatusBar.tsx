import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface Props {
  updatedAt: string;
  refreshInterval: number;
  onRefresh: () => void;
}

export function StatusBar({ updatedAt, refreshInterval, onRefresh }: Props) {
  const [countdown, setCountdown] = useState(refreshInterval);

  useEffect(() => {
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
    <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground bg-muted/50 border-b border-border">
      <span>Aktualisiert: {formatTime(updatedAt)}</span>
      <div className="flex items-center gap-2">
        <span>Neu in {countdown} s</span>
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