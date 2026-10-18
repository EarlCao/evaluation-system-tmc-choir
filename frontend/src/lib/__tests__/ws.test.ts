import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { backoffDelay, connectSocket, socketUrl, type SocketStatus } from "../ws";

/** Minimal controllable WebSocket (MSW is not needed to test reconnect timing). */
class FakeSocket extends EventTarget {
  static OPEN = 1;
  static instances: FakeSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  closedWith: number | null = null;
  constructor(public url: string) {
    super();
    FakeSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close(code = 1000) {
    this.closedWith = code;
  }
  serverOpen() {
    this.readyState = 1;
    this.dispatchEvent(new Event("open"));
  }
  serverSend(data: unknown) {
    this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(data) }));
  }
  serverClose(code: number) {
    this.readyState = 3;
    this.dispatchEvent(new CloseEvent("close", { code }));
  }
}

const latest = () => FakeSocket.instances.at(-1)!;

beforeEach(() => {
  FakeSocket.instances = [];
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", FakeSocket);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("socketUrl / backoffDelay", () => {
  it("follows the page's protocol and host", () => {
    expect(socketUrl("/ws/x/", { protocol: "https:", host: "choir.example" })).toBe(
      "wss://choir.example/ws/x/",
    );
    expect(socketUrl("/ws/x/", { protocol: "http:", host: "localhost:5280" })).toBe(
      "ws://localhost:5280/ws/x/",
    );
  });

  it("doubles from 1 s up to 30 s, with jitter in the upper half", () => {
    const min = () => 0;
    const max = () => 1;
    expect([0, 1, 2, 3, 4, 5, 6].map((a) => backoffDelay(a, 1000, 30_000, max))).toEqual([
      1000, 2000, 4000, 8000, 16000, 30000, 30000,
    ]);
    expect(backoffDelay(0, 1000, 30_000, min)).toBe(500);
  });
});

describe("connectSocket (RT-05)", () => {
  it("delivers messages, ignores pongs and malformed frames, and pings while open", () => {
    const messages: unknown[] = [];
    connectSocket("/ws/notifications/", { onMessage: (m) => messages.push(m) });
    latest().serverOpen();
    latest().serverSend({ type: "unread_count", payload: { unread: 2 } });
    latest().serverSend({ type: "pong" });
    latest().dispatchEvent(new MessageEvent("message", { data: "not json" }));
    expect(messages).toEqual([{ type: "unread_count", payload: { unread: 2 } }]);
    vi.advanceTimersByTime(25_000);
    expect(latest().sent).toEqual(['{"type":"ping"}']);
  });

  it("reconnects with backoff after a dropped connection and reports the resync", () => {
    const statuses: SocketStatus[] = [];
    const onReconnect = vi.fn();
    connectSocket("/ws/notifications/", {
      onMessage: () => {},
      onStatus: (s) => statuses.push(s),
      onReconnect,
      random: () => 1,
    });
    latest().serverOpen();
    latest().serverClose(1006);
    expect(FakeSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(999);
    expect(FakeSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.instances).toHaveLength(2);
    latest().serverClose(1006); // second failure waits 2 s
    vi.advanceTimersByTime(1999);
    expect(FakeSocket.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    latest().serverOpen();
    expect(onReconnect).toHaveBeenCalledTimes(1);
    expect(statuses).toEqual([
      "connecting",
      "open",
      "closed",
      "connecting",
      "closed",
      "connecting",
      "open",
    ]);
  });

  it.each([4401, 4403, 4001])("does not retry after close code %i", (code) => {
    const onFatal = vi.fn();
    connectSocket("/ws/notifications/", { onMessage: () => {}, onFatal });
    latest().serverOpen();
    latest().serverClose(code);
    vi.advanceTimersByTime(120_000);
    expect(FakeSocket.instances).toHaveLength(1);
    expect(onFatal).toHaveBeenCalledWith(code);
  });

  it("stop() closes the socket and cancels a pending reconnect", () => {
    const stop = connectSocket("/ws/notifications/", { onMessage: () => {} });
    latest().serverClose(1006);
    stop();
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(1);

    const stop2 = connectSocket("/ws/admin/", { onMessage: () => {} });
    latest().serverOpen();
    stop2();
    expect(latest().closedWith).toBe(1000);
  });
});
