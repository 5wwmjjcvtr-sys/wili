import { useEffect, useState } from 'react';

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

  return (
    <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground bg-muted/50 border-b border-border">
      <span>Aktualisiert: {formatTime(updatedAt)}</span>
      <span>Neu in {countdown} s</span>
    </div>
  );
}
