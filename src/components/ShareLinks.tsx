import { useState } from 'react';
import { useFavorites } from '@/providers/FavoritesContext';
import { Copy, Check, Link, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ShareLinks() {
  const { generateReadableUrl, generateEncodedUrl, hasFavorites } = useFavorites();
  const [copiedReadable, setCopiedReadable] = useState(false);
  const [copiedEncoded, setCopiedEncoded] = useState(false);

  if (!hasFavorites) return null;

  const copyToClipboard = async (text: string, setCopied: (v: boolean) => void) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const readableUrl = generateReadableUrl();
  const encodedUrl = generateEncodedUrl();

  return (
    <div className="px-4 py-3 space-y-3 border-t border-border">
      <h3 className="text-sm font-semibold text-foreground">Favoriten teilen</h3>

      {/* Encoded (recommended) */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          <span>Kodierter Link <span className="text-primary font-medium">(empfohlen)</span></span>
        </div>
        <div className="flex gap-2">
          <input
            readOnly
            value={encodedUrl}
            className="flex-1 text-xs font-mono bg-muted rounded px-2 py-1.5 text-foreground border border-border truncate"
          />
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 h-8"
            onClick={() => copyToClipboard(encodedUrl, setCopiedEncoded)}
          >
            {copiedEncoded ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* Readable */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link className="h-3 w-3" />
          <span>Lesbarer Link</span>
        </div>
        <div className="flex gap-2">
          <input
            readOnly
            value={readableUrl}
            className="flex-1 text-xs font-mono bg-muted rounded px-2 py-1.5 text-foreground border border-border truncate"
          />
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 h-8"
            onClick={() => copyToClipboard(readableUrl, setCopiedReadable)}
          >
            {copiedReadable ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
