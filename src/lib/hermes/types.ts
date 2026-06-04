/** Shape returned by the dashboard `GET /api/profiles`. One profile == one SDA. */
export interface HermesProfile {
  name: string;
  path: string;
  is_default: boolean;
  model: string | null;
  provider: string | null;
  has_env: boolean;
  skill_count: number;
  gateway_running: boolean;
  description: string;
  description_auto: boolean;
  distribution_name: string | null;
  distribution_version: string | null;
  distribution_source: string | null;
  has_alias: boolean;
  /** Injected into the list response by the app: the agent's Goal (from SOUL.md). */
  goal?: string;
}

export interface CreateAgentInput {
  name: string;
  description?: string;
  model?: string;
  provider?: string;
}

export interface AgentPatch {
  soul?: string;
  description?: string;
  model?: string;
  provider?: string;
}

/** A catalog agent installable via `npx @vectorize-io/self-driving-agents`. */
export interface CatalogAgent {
  /** install path, e.g. "marketing/seo" */
  path: string;
  title: string;
  description: string;
  agentCount: number;
}

export interface CatalogDepartment {
  department: string;
  agents: CatalogAgent[];
}
