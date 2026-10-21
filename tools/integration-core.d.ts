/* Types for tools/integration-core.js, for the Worker (server/src/worker.ts), which builds it in. */
import type {ValidationIssue} from '../crm/logic/validate';
import type {IntegrationContext, IntegrationManifest, IntegrationPlan, Json} from './integration-api';

/** The REST API: the path after /api/v1, the answer's status, body and version (from ETag) */
export type IntegrationCall = (method: string, path: string, body?: unknown, version?: number) => Promise<{status: number; data: unknown; version?: number}>;

export interface LastRun {
  at: string;
  ok: boolean;
  trigger: string;
  counts?: {customers: number; created: number; updated: number; linked: number};
  remaining?: number;
  notes?: string[];
  unmatched?: string[];
  error?: string;
}

export interface Diff { customers?: {id: string; data: Customer}[]; create: unknown[]; update: unknown[]; links: unknown[] }

export declare const API_VERSION: number;
export declare const DEFAULT_MAX_WRITES: number;
export declare function checkManifest(manifest: unknown, id: string): string[];
export declare function makeContext(options: {manifest: IntegrationManifest; settings?: Record<string, Json>; env: Record<string, string | undefined>;
  customers: unknown[]; fetchImpl: typeof fetch; options?: Record<string, string>}): IntegrationContext;
export declare function checkPlan(plan: unknown, manifest: IntegrationManifest, customers: Customer[], validateCustomer: (doc: unknown) => ValidationIssue[]): string[];
export declare function diffPlan(plan: IntegrationPlan, manifest: IntegrationManifest, customers: Customer[]): Diff;
export declare function applyPlan(diff: Diff, manifest: IntegrationManifest, call: IntegrationCall, options?: {maxWrites?: number}):
  Promise<{customers?: number; created: number; updated: number; linked: number; remaining: number}>;
export declare function runOnce(manifest: IntegrationManifest, options: {validateCustomer: (doc: unknown) => ValidationIssue[]; call: IntegrationCall;
  env?: Record<string, string | undefined>; settings?: Record<string, Json>; trigger: string; fetchImpl: typeof fetch; options?: Record<string, string>; now?: () => Date}):
  Promise<{lastRun: LastRun}>;
export declare function updateIntegration<E extends Record<string, unknown>>(call: IntegrationCall, id: string, change: (entry: E) => E | null): Promise<E | null>;
export declare function recordRun(call: IntegrationCall, id: string, lastRun: LastRun, change?: (entry: Record<string, unknown>) => Record<string, unknown>): Promise<unknown>;
