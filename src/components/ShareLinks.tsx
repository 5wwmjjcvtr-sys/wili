import { useState, useEffect } from 'react';
import { useFavorites } from '@/providers/FavoritesContext';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ShareLinks() {
  const { generateShareUrl, hasFavorites, favorites } = useFavorites();
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  useEffect(() => {
    generateShareUrl().then(setShareUrl);
  }, [generateShareUrl, favorites]);

  if (!hasFavorites) return null;

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="px-4 py-3 space-y-2 border-t border-border">
      <h3 className="text-sm font-semibold text-foreground">Favoriten teilen</h3>
      <div className="flex gap-2">
        <input
          readOnly
          value={shareUrl}
          className="flex-1 text-xs font-mono bg-muted rounded px-2 py-1.5 text-foreground border border-border truncate"
        />
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 h-8"
          onClick={copyToClipboard}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}
