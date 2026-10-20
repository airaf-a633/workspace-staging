/** Theme choice shared by the server (first paint) and the switch. "system" follows prefers-color-scheme. */
export type Theme = "system" | "light" | "dark";
export const THEME_COOKIE = "theme";
export const isTheme = (v: unknown): v is Theme => v === "system" || v === "light" || v === "dark";
