"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatClient, type ChatEvent } from "@/lib/chat-client";

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

export function ChatWindow({ agentId }: { agentId: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [conn, setConn] = useState<ConnState>("booting");
  const [connError, setConnError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const clientRef = useRef<ChatClient | null>(null);
  const assistantRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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
          patchAssistant((m) => ({
            ...m,
            text: m.text || e.text,
            streaming: false,
          }));
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
          patchAssistant((m) => ({ ...m, text: m.text, streaming: false }));
          setMessages((prev) => [...prev, { id: newId(), role: "system", text: `⚠ ${e.text}` }]);
          break;
        case "turn_end":
          setRunning(false);
          setStatus(null);
          patchAssistant((m) => ({ ...m, streaming: false }));
          break;
      }
    },
    [patchAssistant],
  );

  // Boot the per-agent chat backend and connect.
  useEffect(() => {
    let cancelled = false;
    const client = (() => null)();
    void client;
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
        await c.start();
        if (cancelled) return;
        setConn("ready");
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
  }, [agentId, onEvent]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

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
    <div className="card flex h-full flex-col overflow-hidden">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
        {conn === "booting" && (
          <p className="text-sm text-[var(--muted)]">Booting Hermes for this agent…</p>
        )}
        {conn === "error" && (
          <p className="text-sm text-red-400">Couldn&apos;t start the agent: {connError}</p>
        )}
        {conn === "ready" && messages.length === 0 && (
          <p className="text-sm text-[var(--muted)]">
            Connected. Say hello to <span className="font-mono">{agentId}</span>.
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
