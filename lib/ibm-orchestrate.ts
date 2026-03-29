/**
 * Legacy shim — the real orchestrator is now lib/agents/unidad.ts (Gemini-powered).
 * This file is kept so any imports don't break during the transition.
 */

export type { AskUnidadParams as OrchestrateParams } from "./agents/unidad";
export { askUnidad as askOrchestrate } from "./agents/unidad";
