"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatClient, type ChatEvent, type HistoryMessage, type SessionMeta } from "@/lib/chat-client";

interface ToolCall {
  id: string;
  name: string;
  preview?: string;
  done?: boolean;
  ok?: boolean;
}
interface Msg {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  thinking?: string;
  tools?: ToolCall[];
  streaming?: boolean;
}

type ConnState = "booting" | "ready" | "error";

let msgSeq = 0;
const newId = () => `m${++msgSeq}`;

function historyToMsgs(history: HistoryMessage[]): Msg[] {
  return history
    .map((h): Msg | null => {
      if (h.role === "tool") return { id: newId(), role: "system", text: `⚙ ${h.name ?? "tool"}` };
      if (!h.text) return null;
      const role = h.role === "assistant" ? "assistant" : h.role === "user" ? "user" : "system";
      return { id: newId(), role, text: h.text };
    })
    .filter((m): m is Msg => m !== null);
}

export function ChatWindow({ agentId }: { agentId: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [activeStoredId, setActiveStoredId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [conn, setConn] = useState<ConnState>("booting");
  const [connError, setConnError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const clientRef = useRef<ChatClient | null>(null);
  const assistantRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const refreshSessions = useCallback(async () => {
    try {
      const list = await clientRef.current!.listSessions();
      setSessions(list);
      setActiveStoredId(clientRef.current!.currentStoredId);
    } catch {
      /* ignore */
    }
  }, []);

  const patchAssistant = useCallback((fn: (m: Msg) => Msg) => {
    const id = assistantRef.current;
    if (!id) return;
    setMessages((prev) => prev.map((m) => (m.id === id ? fn(m) : m)));
  }, []);

  const onEvent = useCallback(
    (e: ChatEvent) => {
      switch (e.kind) {
        case "status":
          setStatus(e.text);
          break;
        case "message_delta":
          setStatus(null);
          patchAssistant((m) => ({ ...m, text: m.text + e.text }));
          break;
        case "message_complete":
          patchAssistant((m) => ({ ...m, text: m.text || e.text, streaming: false }));
          break;
        case "thinking":
        case "reasoning":
          patchAssistant((m) => ({ ...m, thinking: (m.thinking ?? "") + e.text }));
          break;
        case "tool_start":
          patchAssistant((m) => ({
            ...m,
            tools: [...(m.tools ?? []), { id: e.id, name: e.name, preview: e.preview }],
          }));
          break;
        case "tool_complete":
          patchAssistant((m) => ({
            ...m,
            tools: (m.tools ?? []).map((t) =>
              t.id === e.id || t.name === e.name ? { ...t, done: true, ok: e.ok } : t,
            ),
          }));
          break;
        case "notice":
          setMessages((prev) => [...prev, { id: newId(), role: "system", text: e.text }]);
          break;
        case "error":
          patchAssistant((m) => ({ ...m, streaming: false }));
          setMessages((prev) => [...prev, { id: newId(), role: "system", text: `⚠ ${e.text}` }]);
          break;
        case "turn_end":
          setRunning(false);
          setStatus(null);
          patchAssistant((m) => ({ ...m, streaming: false }));
          void refreshSessions();
          break;
      }
    },
    [patchAssistant, refreshSessions],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setConn("booting");
      try {
        const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/chat`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to start agent backend");
        if (cancelled) return;
        const c = new ChatClient(data.wsUrl, onEvent);
        clientRef.current = c;
        await c.connect();
        if (cancelled) return;
        setConn("ready");
        void refreshSessions();
      } catch (err) {
        if (cancelled) return;
        setConnError((err as Error).message);
        setConn("error");
      }
    })();
    return () => {
      cancelled = true;
      clientRef.current?.close();
      clientRef.current = null;
    };
  }, [agentId, onEvent, refreshSessions]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  function newChat() {
    clientRef.current?.reset();
    assistantRef.current = null;
    setMessages([]);
    setActiveStoredId(null);
    setRunning(false);
  }

  async function openSession(meta: SessionMeta) {
    if (running) return;
    setStatus(null);
    assistantRef.current = null;
    try {
      const history = await clientRef.current!.resume(meta.id);
      setMessages(historyToMsgs(history));
      setActiveStoredId(meta.id);
    } catch (err) {
      setMessages([{ id: newId(), role: "system", text: `⚠ ${(err as Error).message}` }]);
    }
  }

  async function removeSession(e: React.MouseEvent, meta: SessionMeta) {
    e.stopPropagation();
    if (!confirm("Delete this conversation?")) return;
    try {
      await clientRef.current!.deleteSession(meta.id);
      if (activeStoredId === meta.id) newChat();
      await refreshSessions();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || running || conn !== "ready") return;
    const userMsg: Msg = { id: newId(), role: "user", text };
    const asst: Msg = { id: newId(), role: "assistant", text: "", streaming: true, tools: [] };
    assistantRef.current = asst.id;
    setMessages((prev) => [...prev, userMsg, asst]);
    setInput("");
    setRunning(true);
    try {
      await clientRef.current!.send(text);
    } catch (err) {
      setRunning(false);
      setMessages((prev) => [...prev, { id: newId(), role: "system", text: `⚠ ${(err as Error).message}` }]);
    }
  }

  async function cancel() {
    await clientRef.current?.interrupt();
    setRunning(false);
  }

  return (
    <div className="card flex h-full overflow-hidden">
      {/* Sessions sidebar */}
      <aside className="flex w-60 shrink-0 flex-col border-r" style={{ borderColor: "var(--border)" }}>
        <div className="p-3">
          <button onClick={newChat} className="btn btn-accent w-full">+ New chat</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Sessions
          </p>
          {sessions.length === 0 && (
            <p className="px-2 py-2 text-xs text-[var(--muted)]">No conversations yet.</p>
          )}
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => openSession(s)}
              className={`group mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-2)] ${
                activeStoredId === s.id ? "bg-[var(--surface-2)]" : ""
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate">{s.title || s.preview || "Untitled chat"}</span>
                <span className="block truncate text-[11px] text-[var(--muted)]">
                  {s.message_count} msg{s.message_count === 1 ? "" : "s"}
                </span>
              </span>
              <span
                onClick={(e) => removeSession(e, s)}
                className="hidden shrink-0 rounded px-1 text-xs text-[var(--muted)] hover:text-red-400 group-hover:block"
                title="Delete conversation"
              >
                ✕
              </span>
            </button>
          ))}
        </div>
      </aside>

      {/* Chat column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
          {conn === "booting" && <p className="text-sm text-[var(--muted)]">Booting Hermes for this agent…</p>}
          {conn === "error" && <p className="text-sm text-red-400">Couldn&apos;t start the agent: {connError}</p>}
          {conn === "ready" && messages.length === 0 && (
            <p className="text-sm text-[var(--muted)]">
              Connected. Say hello to <span className="font-mono">{agentId}</span>, or open a past session.
            </p>
          )}
          {messages.map((m) => (
            <MessageBubble key={m.id} msg={m} />
          ))}
          {status && <p className="text-xs italic text-[var(--muted)]">{status}</p>}
        </div>

        <div className="border-t p-3">
          <div className="flex items-end gap-2">
            <textarea
              className="input max-h-40 min-h-11 flex-1 resize-none"
              placeholder={conn === "ready" ? "Message…" : "Waiting for agent…"}
              value={input}
              disabled={conn !== "ready"}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            {running ? (
              <button onClick={cancel} className="btn btn-ghost">Stop</button>
            ) : (
              <button onClick={send} disabled={conn !== "ready" || !input.trim()} className="btn btn-accent">
                Send
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: Msg }) {
  if (msg.role === "system") {
    return <p className="text-center text-xs text-[var(--muted)]">{msg.text}</p>;
  }
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
          isUser ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-2)]"
        }`}
      >
        {msg.thinking && (
          <details className="mb-2 text-xs text-[var(--muted)]">
            <summary className="cursor-pointer select-none">💭 thinking</summary>
            <pre className="mt-1 whitespace-pre-wrap font-mono">{msg.thinking}</pre>
          </details>
        )}
        {msg.tools && msg.tools.length > 0 && (
          <div className="mb-2 space-y-1">
            {msg.tools.map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <span>{t.done ? (t.ok ? "✓" : "✕") : "⟳"}</span>
                <span className="font-mono">{t.name}</span>
                {t.preview && <span className="truncate opacity-70">{t.preview}</span>}
              </div>
            ))}
          </div>
        )}
        <div className="whitespace-pre-wrap">
          {msg.text}
          {msg.streaming && !msg.text && <span className="opacity-50">▍</span>}
        </div>
      </div>
    </div>
  );
}
