"use client";

import Link from "next/link";
import { use, useState } from "react";
import { ChatWindow } from "@/components/ChatWindow";
import { ConfigPanel } from "@/components/ConfigPanel";
import { MentalModelsPanel } from "@/components/MentalModelsPanel";

type Tab = "chat" | "models" | "config";

export default function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const agentId = decodeURIComponent(id);
  const [tab, setTab] = useState<Tab>("chat");

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
            ← Agents
          </Link>
          <h1 className="font-mono text-lg font-semibold">{agentId}</h1>
        </div>
        <div className="flex gap-1 rounded-lg bg-[var(--surface-2)] p-1 text-sm">
          {([
            ["chat", "Chat"],
            ["models", "Mental models"],
            ["config", "Configure"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              className={`btn px-4 py-1.5 ${tab === key ? "btn-accent" : "btn-ghost"}`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {tab === "chat" && <ChatWindow agentId={agentId} />}
        {tab === "models" && <MentalModelsPanel agentId={agentId} />}
        {tab === "config" && <ConfigPanel agentId={agentId} />}
      </div>
    </div>
  );
}
