/**
 * WebSocket client with reconnect (Realtime Architecture, RT-05, NFR-04).
 *
 * WebSockets are an optimisation: every piece of state is also available over REST, and
 * callers poll while the socket is not open. Reconnects use exponential backoff with jitter
 * (1 s → 30 s). Close codes that mean "you may not be here" are not retried.
 */

export type SocketStatus = "connecting" | "open" | "closed";

export interface SocketMessage {
  type: string;
  payload: unknown;
  sent_at?: string;
}

/** 4401 not signed in / not active · 4403 not allowed · 4001 session revoked. */
export const NO_RETRY_CODES: ReadonlySet<number> = new Set([4401, 4403, 4001]);
const PING_EVERY_MS = 25_000;

export interface SocketOptions {
  onMessage: (message: SocketMessage) => void;
  onStatus?: (status: SocketStatus) => void;
  /** The server refused us for good (see NO_RETRY_CODES). */
  onFatal?: (code: number) => void;
  /** Called on every successful open after the first (state may have been missed). */
  onReconnect?: () => void;
  minDelayMs?: number;
  maxDelayMs?: number;
  random?: () => number;
}

export function socketUrl(path: string, location?: Pick<Location, "protocol" | "host">) {
  if (!location) {
    const configuredWsBase = (import.meta.env.VITE_WS_BASE_URL as string | undefined)?.trim();
    if (configuredWsBase) {
      return `${configuredWsBase.replace(/\/+$/, "")}${path}`;
    }
  }
  const loc = location ?? window.location;
  const protocol = loc.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${loc.host}${path}`;
}

/** Delay before reconnect attempt `attempt` (0-based): full backoff halved, plus jitter. */
export function backoffDelay(attempt: number, minMs = 1000, maxMs = 30_000, random = Math.random) {
  const base = Math.min(maxMs, minMs * 2 ** attempt);
  return Math.round(base / 2 + (random() * base) / 2);
}

function parse(data: unknown): SocketMessage | null {
  if (typeof data !== "string") return null;
  try {
    const value: unknown = JSON.parse(data);
    if (value && typeof value === "object" && "type" in value && typeof value.type === "string") {
      return value as SocketMessage;
    }
  } catch {
    // ignore malformed frames
  }
  return null;
}

/** Connect to `path` (e.g. "/ws/notifications/") and keep the connection alive. Returns stop(). */
export function connectSocket(path: string, options: SocketOptions): () => void {
  const { onMessage, onStatus, onFatal, onReconnect } = options;
  let socket: WebSocket | null = null;
  let attempt = 0;
  let opened = false;
  let stopped = false;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let pingTimer: ReturnType<typeof setInterval> | undefined;

  const open = () => {
    if (stopped) return;
    onStatus?.("connecting");
    socket = new WebSocket(socketUrl(path));
    socket.addEventListener("open", () => {
      attempt = 0;
      onStatus?.("open");
      if (opened) onReconnect?.();
      opened = true;
      pingTimer = setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "ping" }));
      }, PING_EVERY_MS);
    });
    socket.addEventListener("message", (event: MessageEvent) => {
      const message = parse(event.data);
      if (message && message.type !== "pong") onMessage(message);
    });
    socket.addEventListener("close", (event: CloseEvent) => {
      clearInterval(pingTimer);
      socket = null;
      if (stopped) return;
      onStatus?.("closed");
      if (NO_RETRY_CODES.has(event.code)) {
        onFatal?.(event.code);
        return;
      }
      const delay = backoffDelay(attempt, options.minDelayMs, options.maxDelayMs, options.random);
      attempt += 1;
      retryTimer = setTimeout(open, delay);
    });
  };

  open();
  return () => {
    stopped = true;
    clearTimeout(retryTimer);
    clearInterval(pingTimer);
    socket?.close(1000);
    socket = null;
  };
}
