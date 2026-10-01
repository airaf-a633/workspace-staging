"use client";

import { useSyncExternalStore } from "react";

/**
 * Preview-only AI state for this browser tab: automations people switched on from Ask AI, and credits
 * spent. Lives in sessionStorage (resets when the tab closes); the real app keeps both in the database.
 */
export interface Recipe {
  id: string;
  /** Keys under ai.recipes.<key> for the When / Only if / Then wording. */
  key: "quietQuote" | "urgentRoute" | "afterHours";
  on: boolean;
  createdAt: number;
}

interface State {
  recipes: Recipe[];
  spent: number;
  /** Names the owner gave agents ("Noor"). Customers still see them marked as AI. */
  names: Partial<Record<string, string>>;
}

const KEY = "preview-ai";
const EMPTY: State = { recipes: [], spent: 0, names: {} };
const listeners = new Set<() => void>();
let cache: State | null = null;

function read(): State {
  if (cache) return cache;
  try {
    cache = { ...EMPTY, ...JSON.parse(window.sessionStorage.getItem(KEY) ?? "{}") };
  } catch {
    cache = EMPTY;
  }
  return cache!;
}

function write(next: State) {
  cache = next;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: keep it in memory for this page */
  }
  listeners.forEach((fn) => fn());
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export function useAiState() {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** Charge credits for one AI run (suggestion 1, translation 1, summary 2, ask 2, auto-reply 3). */
export function spend(credits: number) {
  const s = read();
  write({ ...s, spent: s.spent + credits });
}

export function addRecipe(key: Recipe["key"]) {
  const s = read();
  if (s.recipes.some((r) => r.key === key)) return write({ ...s, recipes: s.recipes.map((r) => (r.key === key ? { ...r, on: true } : r)) });
  write({ ...s, recipes: [...s.recipes, { id: `${key}-${Date.now()}`, key, on: true, createdAt: Date.now() }] });
}

export function nameAgent(agent: string, name: string) {
  const s = read();
  write({ ...s, names: { ...s.names, [agent]: name.trim().slice(0, 30) || undefined } });
}

export function toggleRecipe(id: string) {
  const s = read();
  write({ ...s, recipes: s.recipes.map((r) => (r.id === id ? { ...r, on: !r.on } : r)) });
}

export function removeRecipe(id: string) {
  const s = read();
  write({ ...s, recipes: s.recipes.filter((r) => r.id !== id) });
}
