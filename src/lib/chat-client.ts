"use client";

/**
 * Browser client for Hermes' tui_gateway chat protocol over `/api/ws`.
 *
 * Wire: JSON-RPC 2.0. Requests `{jsonrpc,id,method,params}` get a matching
 * `{id,result|error}`. Streaming arrives as notifications
 * `{method:"event", params:{type, sid, ...}}`.
 *
 * Flow: open WS -> wait for `gateway.ready` -> `session.create` ->
 * `prompt.submit {session_id, text}` -> consume `message.*` / `tool.*` events.
 */

export type ChatEvent =
  | { kind: "status"; text: string }
  | { kind: "message_start" }
  | { kind: "message_delta"; text: string }
  | { kind: "message_complete"; text: string }
  | { kind: "thinking"; text: string }
  | { kind: "reasoning"; text: string }
  | { kind: "tool_start"; id: string; name: string; preview?: string }
  | { kind: "tool_complete"; id: string; name: string; ok: boolean }
  | { kind: "notice"; text: string }
  | { kind: "error"; text: string }
  | { kind: "turn_end" };

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };

export class ChatClient {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private sessionId: string | null = null;
  private ready: Promise<void>;
  private resolveReady!: () => void;
  private rejectReady!: (e: Error) => void;

  constructor(
    private wsUrl: string,
    private onEvent: (e: ChatEvent) => void,
  ) {
    this.ready = new Promise((res, rej) => {
      this.resolveReady = res;
      this.rejectReady = rej;
    });
  }

  connect(): Promise<void> {
    const ws = new WebSocket(this.wsUrl);
    this.ws = ws;
    ws.onmessage = (ev) => this.onMessage(ev.data);
    ws.onerror = () => this.rejectReady(new Error("WebSocket error"));
    ws.onclose = () => {
      for (const p of this.pending.values()) p.reject(new Error("connection closed"));
      this.pending.clear();
    };
    return this.ready;
  }

  private rpc(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      this.ws?.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
    });
  }

  private async onMessage(raw: string) {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (typeof msg.id === "number" && (("result" in msg) || ("error" in msg))) {
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      if (msg.error) p.reject(new Error((msg.error as { message?: string }).message ?? "rpc error"));
      else p.resolve(msg.result);
      return;
    }

    if (msg.method === "event") {
      this.handleEvent((msg.params ?? {}) as Record<string, unknown>);
    }
  }

  private handleEvent(envelope: Record<string, unknown>) {
    const type = String(envelope.type ?? "");
    // Event data is nested under `payload`; type/session_id live on the envelope.
    const p = (envelope.payload ?? {}) as Record<string, unknown>;
    const text = typeof p.text === "string" ? p.text : "";
    switch (type) {
      case "gateway.ready":
        this.resolveReady();
        break;
      case "status.update":
        if (text) this.onEvent({ kind: "status", text });
        break;
      case "message.start":
        this.onEvent({ kind: "message_start" });
        break;
      case "message.delta":
        this.onEvent({ kind: "message_delta", text });
        break;
      case "message.complete":
        this.onEvent({ kind: "message_complete", text });
        this.onEvent({ kind: "turn_end" });
        break;
      case "thinking.delta":
        this.onEvent({ kind: "thinking", text });
        break;
      case "reasoning.delta":
        this.onEvent({ kind: "reasoning", text });
        break;
      case "tool.start":
        this.onEvent({
          kind: "tool_start",
          id: String(p.tool_call_id ?? p.id ?? p.name ?? ""),
          name: String(p.name ?? "tool"),
          preview: typeof p.preview === "string" ? p.preview : undefined,
        });
        break;
      case "tool.complete":
        this.onEvent({
          kind: "tool_complete",
          id: String(p.tool_call_id ?? p.id ?? p.name ?? ""),
          name: String(p.name ?? "tool"),
          ok: p.error == null,
        });
        break;
      case "error":
        this.onEvent({ kind: "error", text: String(p.message ?? "error") });
        this.onEvent({ kind: "turn_end" });
        break;
      case "clarify.request":
      case "approval.request":
      case "sudo.request":
      case "secret.request":
        this.onEvent({
          kind: "notice",
          text:
            typeof p.question === "string"
              ? p.question
              : `Agent is waiting on: ${type.replace(".request", "")}`,
        });
        break;
      default:
        break;
    }
  }

  /** Create the chat session (once). Safe to call after connect(). */
  async start(): Promise<void> {
    await this.ready;
    if (this.sessionId) return;
    const res = (await this.rpc("session.create", { cols: 100 })) as { session_id: string };
    this.sessionId = res.session_id;
  }

  async send(text: string): Promise<void> {
    await this.start();
    await this.rpc("prompt.submit", { session_id: this.sessionId, text });
  }

  async interrupt(): Promise<void> {
    if (this.sessionId) await this.rpc("session.interrupt", { session_id: this.sessionId }).catch(() => {});
  }

  close() {
    this.ws?.close();
  }
}
