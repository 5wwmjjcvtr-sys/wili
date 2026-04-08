import { Alert as AlertType } from '@/types/station';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface Props {
  alerts: AlertType[];
}

export function AlertsSection({ alerts }: Props) {
  if (alerts.length === 0) return null;

  return (
    <div className="px-4 py-2 space-y-2">
      {alerts.map((alert) => (
        <AlertItem key={alert.id} alert={alert} />
      ))}
    </div>
  );
}

function AlertItem({ alert }: { alert: AlertType }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-md border border-[hsl(var(--wl-alert)/0.4)] bg-[hsl(var(--wl-alert)/0.08)] p-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-start gap-2 w-full text-left"
      >
        <AlertTriangle className="h-4 w-4 text-[hsl(var(--wl-alert))] shrink-0 mt-0.5" />
        <span className="text-sm font-medium text-foreground flex-1">{alert.title}</span>
        {alert.description && (
          expanded
            ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>
      {expanded && alert.description && (
        <p className="text-xs text-muted-foreground mt-2 ml-6">{alert.description}</p>
      )}
      {alert.relatedLines.length > 0 && (
        <div className="flex gap-1 mt-1 ml-6">
          {alert.relatedLines.map((line) => (
            <span key={line} className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {line}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
