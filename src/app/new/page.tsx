"use client";

import { useState } from "react";
import { CreateBlankForm } from "@/components/CreateBlankForm";
import { CatalogPicker } from "@/components/CatalogPicker";

export default function NewAgentPage() {
  const [tab, setTab] = useState<"blank" | "catalog">("blank");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">New agent</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Spin up a fresh Hermes profile, or install a pre-built self-driving agent from the catalog.
      </p>

      <div className="mt-6 flex gap-1 rounded-lg bg-[var(--surface-2)] p-1 text-sm">
        <button
          className={`btn flex-1 ${tab === "blank" ? "btn-accent" : "btn-ghost"}`}
          onClick={() => setTab("blank")}
        >
          Blank
        </button>
        <button
          className={`btn flex-1 ${tab === "catalog" ? "btn-accent" : "btn-ghost"}`}
          onClick={() => setTab("catalog")}
        >
          From catalog
        </button>
      </div>

      <div className="mt-6">{tab === "blank" ? <CreateBlankForm /> : <CatalogPicker />}</div>
    </div>
  );
}
