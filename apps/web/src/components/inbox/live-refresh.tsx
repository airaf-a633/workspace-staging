"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/browser";

/**
 * Live inbox (decided 2026-10-02: Supabase Realtime). Listens for new or changed messages and conversations
 * in this workspace and refreshes the page's data. Realtime applies the same row-level security, so
 * people only hear about chats they may see. Bursts are merged into one refresh.
 * With reply targets on, `tickSeconds` also refreshes while the tab is open and visible, so the clocks on the chats keep up with the time.
 */
export function LiveRefresh({ workspaceId, tickSeconds }: { workspaceId: string; tickSeconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = browserClient();
    let timer: number | undefined;
    const refresh = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => router.refresh(), 300);
    };
    const channel = supabase
      .channel(`inbox-${workspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `workspace_id=eq.${workspaceId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations", filter: `workspace_id=eq.${workspaceId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_events", filter: `workspace_id=eq.${workspaceId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_notes", filter: `workspace_id=eq.${workspaceId}` }, refresh)
      .subscribe();
    const tick = tickSeconds ? window.setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, tickSeconds * 1000) : undefined;
    return () => {
      window.clearTimeout(timer);
      if (tick) window.clearInterval(tick);
      void supabase.removeChannel(channel);
    };
  }, [router, workspaceId, tickSeconds]);
  return null;
}
