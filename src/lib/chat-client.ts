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

/** A stored conversation, as returned by `session.list`. */
export interface SessionMeta {
  id: string;
  title: string;
  preview: string;
  started_at: number;
  message_count: number;
}

/** A prior message replayed by `session.resume`. */
export interface HistoryMessage {
  role: "user" | "assistant" | "system" | "tool";
  text?: string;
  name?: string;
}

export class ChatClient {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private sessionId: string | null = null;
  private storedId: string | null = null;
  private toolSeq = 0;
  private pendingClarify: string | null = null;
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
        // Guarantee turn_end fires even if the message_complete handler throws,
        // so the UI never gets stuck "running".
        try {
          this.onEvent({ kind: "message_complete", text });
        } finally {
          this.onEvent({ kind: "turn_end" });
        }
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
          // `tool_id` is the unique per-call id; fall back to a synthetic unique
          // id so two calls of the same tool never collide on a React key.
          id: String(p.tool_id ?? p.tool_call_id ?? `${p.name ?? "tool"}-${++this.toolSeq}`),
          name: String(p.name ?? "tool"),
          preview: typeof p.context === "string" ? p.context : typeof p.args_text === "string" ? p.args_text : undefined,
        });
        break;
      case "tool.complete":
        this.onEvent({
          kind: "tool_complete",
          id: String(p.tool_id ?? p.tool_call_id ?? p.name ?? ""),
          name: String(p.name ?? "tool"),
          ok: p.error == null,
        });
        break;
      case "error":
        this.onEvent({ kind: "error", text: String(p.message ?? "error") });
        this.onEvent({ kind: "turn_end" });
        break;
      case "approval.request":
        // Autonomous: approve tool use (YOLO mode usually bypasses this already).
        this.respond("approval.respond", { choice: "approve", all: false });
        break;
      case "sudo.request":
        // Don't pipe a password through chat — skip so the agent doesn't hang.
        this.respond("sudo.respond", { request_id: p.request_id, password: "" });
        this.onEvent({ kind: "notice", text: "Skipped a sudo request." });
        break;
      case "secret.request":
        this.respond("secret.respond", { request_id: p.request_id, value: "" });
        this.onEvent({ kind: "notice", text: "Skipped a secret request." });
        break;
      case "clarify.request":
        // The agent is asking the user a question and is blocked until answered.
        // Stash the request id; the user's next message answers it (see send()).
        this.pendingClarify = typeof p.request_id === "string" ? p.request_id : null;
        this.onEvent({
          kind: "notice",
          text: typeof p.question === "string" ? `❓ ${p.question}` : "The agent asked a question — reply to continue.",
        });
        break;
      default:
        break;
    }
  }

  /** The stored (DB) id of the active conversation, for sidebar highlighting. */
  get currentStoredId(): string | null {
    return this.storedId;
  }

  /** List stored conversations for this agent. */
  async listSessions(): Promise<SessionMeta[]> {
    await this.ready;
    const res = (await this.rpc("session.list", { limit: 100 })) as { sessions: SessionMeta[] };
    return res.sessions ?? [];
  }

  /** Begin a fresh conversation. */
  async newSession(): Promise<void> {
    await this.ready;
    const res = (await this.rpc("session.create", { cols: 100 })) as {
      session_id: string;
      stored_session_id?: string;
    };
    this.sessionId = res.session_id;
    this.storedId = res.stored_session_id ?? res.session_id;
  }

  /** Reopen a stored conversation; returns its prior messages to render. */
  async resume(storedId: string): Promise<HistoryMessage[]> {
    await this.ready;
    const res = (await this.rpc("session.resume", { session_id: storedId, cols: 100 })) as {
      session_id: string;
      messages: HistoryMessage[];
    };
    this.sessionId = res.session_id;
    this.storedId = storedId;
    return res.messages ?? [];
  }

  async deleteSession(storedId: string): Promise<void> {
    await this.rpc("session.delete", { session_id: storedId });
  }

  /** Forget the active session so the next send() lazily starts a fresh one. */
  reset(): void {
    this.sessionId = null;
    this.storedId = null;
    this.pendingClarify = null;
  }

  private async ensureSession(): Promise<void> {
    if (!this.sessionId) await this.newSession();
  }

  /** Fire-and-forget response to a gateway prompt (approval/sudo/secret/clarify). */
  private respond(method: string, params: Record<string, unknown>): void {
    this.rpc(method, { session_id: this.sessionId, ...params }).catch(() => {});
  }

  async send(text: string): Promise<void> {
    // If the agent is waiting on a clarifying question, this message answers it
    // (rather than starting a new turn, which the busy session would reject).
    if (this.pendingClarify) {
      const requestId = this.pendingClarify;
      this.pendingClarify = null;
      await this.rpc("clarify.respond", { session_id: this.sessionId, request_id: requestId, answer: text });
      return;
    }
    await this.ensureSession();
    await this.rpc("prompt.submit", { session_id: this.sessionId, text });
  }

  async interrupt(): Promise<void> {
    if (this.sessionId) await this.rpc("session.interrupt", { session_id: this.sessionId }).catch(() => {});
  }

  close() {
    this.ws?.close();
  }
}
