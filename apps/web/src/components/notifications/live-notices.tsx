"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/browser";

/**
 * A new notice appears in the bell without a reload (Supabase Realtime, the same way the inbox stays live).
 * Realtime applies row-level security, and the filter narrows it to this person's own notices. Bursts become one refresh.
 */
export function LiveNotices({ workspaceId, memberId }: { workspaceId: string; memberId: string }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = browserClient();
    let timer: number | undefined;
    const refresh = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => router.refresh(), 300);
    };
    const channel = supabase
      .channel(`notices-${workspaceId}-${memberId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `member_id=eq.${memberId}` }, refresh)
      .subscribe();
    return () => {
      window.clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [router, workspaceId, memberId]);
  return null;
}
