import { NextResponse } from "next/server";
import { z } from "zod";
import { appOrigin } from "@/lib/app-origin";
import { GUID } from "@/lib/channels/teams-api";
import { teamsPackage } from "@/lib/channels/teams-package";
import { can, loadWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

/**
 * Downloads the Teams app file for one company's bot (decided 2026-11-02): manifest and icons, pre-filled, for the
 * company's admin to upload to Teams. Only people who manage channels may download it. The Teams app's own id is the
 * channel's id, so a fresh download updates the same app instead of adding a second one.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/channels/teams/[id]/package">) {
  const { id } = await ctx.params;
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  if (!z.uuid().safeParse(id).success || !/^[a-z0-9-]{2,60}$/.test(slug)) return new NextResponse("Bad request", { status: 400 });
  const { supabase, workspace } = await loadWorkspace(slug);
  if (!(await can(workspace.id, "numbers.manage"))) return new NextResponse("Not found", { status: 404 });
  const { data: ch } = await supabase.from("channels").select("id, name, settings").eq("id", id).eq("workspace_id", workspace.id).eq("type", "teams").maybeSingle();
  const botId = (ch?.settings as { app_id?: unknown } | null)?.app_id;
  if (!ch || typeof botId !== "string" || !GUID.test(botId)) return new NextResponse("Not found", { status: 404 });

  const file = teamsPackage({ appId: ch.id, botId, name: ch.name, company: workspace.name, origin: await appOrigin() });
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": 'attachment; filename="relay-help-desk-teams-app.zip"',
      "cache-control": "no-store",
    },
  });
}
