export interface WlErrorMessage {
  value: string;
  messageCode: number;
  serverTime: string;
}

/**
 * Type guard: returns true if the API response is a WL error (has `message` block, no `data` block).
 */
export function isWienerLinienError(data: unknown): data is { message: WlErrorMessage } {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    'message' in d &&
    typeof (d.message as any)?.messageCode === 'number' &&
    !('data' in d)
  );
}

/**
 * Maps a WL messageCode to a user-facing German error string.
 * Returns empty string for code 322 (no data — not an error, just an empty state).
 */
export function wlErrorText(code: number, apiFallback: string): string {
  switch (code) {
    case 311: return 'Wiener Linien Datenbank nicht verfügbar.';
    case 312: return 'Haltestelle nicht gefunden.';
    case 316: return 'API-Anfragelimit erreicht – bitte kurz warten.';
    case 320: return 'Ungültige API-Anfrage.';
    case 321: return 'Pflichtparameter fehlt in der API-Anfrage.';
    case 322: return ''; // leerer Zustand, kein Fehler
    default:  return apiFallback || 'Unbekannter API-Fehler.';
  }
}

/** Codes where a retry (e.g. via proxy) makes sense */
export function isRetryableCode(code: number): boolean {
  return code === 311 || code === 316;
}

/** Code 322 = no data in DB — treat as empty result, not error */
export const WL_CODE_NO_DATA = 322;

export class WlApiError extends Error {
  readonly messageCode: number;
  readonly serverTime: string;
  readonly retryable: boolean;

  constructor(msg: WlErrorMessage) {
    super(wlErrorText(msg.messageCode, msg.value));
    this.messageCode = msg.messageCode;
    this.serverTime = msg.serverTime;
    this.retryable = isRetryableCode(msg.messageCode);
  }
}
