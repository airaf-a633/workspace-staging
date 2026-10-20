import { Fragment, createElement, type ReactNode } from "react";
import type { Locale } from "./config";
import { intlLocale } from "./config";

/**
 * A message is a string with {placeholders}, or a plural set picked by {count}:
 * { one: "{count} chat", other: "{count} chats" }. Arabic uses all six plural forms
 * (zero, one, two, few, many, other); English needs one and other.
 */
export type Plural = { zero?: string; one?: string; two?: string; few?: string; many?: string; other: string };
type Node = string | Plural | { [key: string]: Node };

/** The shape every language file must match: same keys, any wording. */
export type Shape<T> = T extends string ? string : IsPlural<T> extends true ? Plural : { [K in keyof T]: Shape<T[K]> };
/** A plural set has `other` and only plural-category keys, so a group like { search, mine, other } isn't one. */
type IsPlural<T> = T extends { other: string } ? (Exclude<keyof T, keyof Plural> extends never ? true : false) : false;

type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;
type Depth = [never, 0, 1, 2, 3];
/** "inbox.title" style keys, down to strings and plural sets (at most four levels, to keep TypeScript fast). */
export type Paths<T, D extends number = 4> = [D] extends [never]
  ? never
  : T extends string
    ? never
    : { [K in keyof T & string]: T[K] extends string ? K : IsPlural<T[K]> extends true ? K : Join<K, Paths<T[K], Depth[D]>> }[keyof T & string];

export type Vars = Record<string, string | number>;

function lookup(tree: Node, path: string): Node | undefined {
  let cur: Node | undefined = tree;
  for (const part of path.split(".")) {
    if (cur === undefined || typeof cur === "string") return undefined;
    cur = (cur as Record<string, Node>)[part];
  }
  return cur;
}

/**
 * Values dropped into a sentence (a name, a deal title) keep their own direction: "12 x ThinkPad" inside an
 * Arabic sentence, or an Arabic name inside an English one, would otherwise be reordered by the bidi
 * algorithm. First-strong isolate (U+2068) … pop directional isolate (U+2069), invisible on screen.
 */
const FSI = "\u2068";
const PDI = "\u2069";
export const isolate = (s: string) => (s ? `${FSI}${s}${PDI}` : s);

const CATEGORIES = new Set(["zero", "one", "two", "few", "many", "other"]);
const isPlural = (n: Node): n is Plural => typeof n === "object" && typeof (n as Plural).other === "string" && Object.keys(n).every((k) => CATEGORIES.has(k));

export function createTranslator<T>(messages: T, locale: Locale, fallback?: T) {
  const rules = new Intl.PluralRules(intlLocale(locale));
  const nf = new Intl.NumberFormat(intlLocale(locale));

  function pick(key: string, vars?: Vars): string {
    let node = lookup(messages as Node, key);
    if (node === undefined && fallback) node = lookup(fallback as Node, key);
    if (node === undefined) return key;
    let text: string;
    if (isPlural(node)) {
      const n = Number(vars?.count ?? 0);
      // Exact zero gets its own form where the language has one (Arabic), else the CLDR category.
      text = (n === 0 && node.zero) || node[rules.select(n) as keyof Plural] || node.other;
    } else if (typeof node === "string") text = node;
    else return key;
    return text;
  }

  function fill(text: string, vars?: Vars) {
    if (!vars) return text;
    return text.replace(/\{(\w+)\}/g, (m, name: string) => {
      const v = vars[name];
      return v === undefined ? m : typeof v === "number" ? nf.format(v) : isolate(v);
    });
  }

  /** Plain text. */
  function t(key: string, vars?: Vars): string {
    return fill(pick(key, vars), vars);
  }

  /** Text with parts swapped for React nodes, e.g. a bold name inside a sentence. */
  t.rich = (key: string, vars: Record<string, ReactNode>): ReactNode => {
    const text = pick(key, vars as Vars);
    const out: ReactNode[] = [];
    let last = 0;
    text.replace(/\{(\w+)\}/g, (m, name: string, at: number) => {
      out.push(text.slice(last, at));
      const v = vars[name];
      // A node (a bold name, a link) is wrapped in <bdi> for the same reason strings are isolated.
      out.push(v === undefined ? m : typeof v === "number" ? nf.format(v) : typeof v === "string" ? isolate(v) : createElement("bdi", null, v));
      last = at + m.length;
      return m;
    });
    out.push(text.slice(last));
    return createElement(Fragment, null, ...out.map((p, i) => createElement(Fragment, { key: i }, p)));
  };

  t.has = (key: string) => lookup(messages as Node, key) !== undefined;
  return t;
}

export type Translator = ReturnType<typeof createTranslator>;

/** A translator narrowed to one top-level section, with its keys checked: useT("inbox")("title"). */
export type ScopedT<Tree> = ((key: Paths<Tree>, vars?: Vars) => string) & {
  rich: (key: Paths<Tree>, vars: Record<string, ReactNode>) => ReactNode;
  has: (key: string) => boolean;
};

export function scoped(t: Translator, ns: string) {
  const f = (key: string, vars?: Vars) => t(`${ns}.${key}`, vars);
  f.rich = (key: string, vars: Record<string, ReactNode>) => t.rich(`${ns}.${key}`, vars);
  f.has = (key: string) => t.has(`${ns}.${key}`);
  return f;
}
