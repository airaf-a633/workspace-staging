"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/browser";

/**
 * Live inbox (decided 2026-10-02: Supabase Realtime). Listens for new or changed messages and conversations
 * in this workspace and refreshes the page's data. Realtime applies the same row-level security, so
 * people only hear about chats they may see. Bursts are merged into one refresh.
 */
export function LiveRefresh({ workspaceId }: { workspaceId: string }) {
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
      .subscribe();
    return () => {
      window.clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [router, workspaceId]);
  return null;
}
