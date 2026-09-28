"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient, getUser } from "@/lib/supabase/server";

export async function acceptInvite(form: FormData) {
  const token = String(form.get("token") ?? "");
  const here = `/invite/${encodeURIComponent(token)}`;
  const user = await getUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(here)}`);

  const name = z.string().trim().min(1).max(80).safeParse(form.get("name"));
  if (!name.success) redirect(`${here}?error=${encodeURIComponent("Enter your name.")}`);

  const supabase = await createClient();
  const { data: workspaceId, error } = await supabase.rpc("accept_invite", { p_token: token, p_display_name: name.data });
  if (error) {
    const msg =
      error.code === "42501"
        ? `This invite was sent to a different email. You're signed in as ${user.email}.`
        : error.code === "23505"
          ? "You're already a member of this workspace."
          : "This invite link is invalid or has expired. Ask for a new one.";
    redirect(`${here}?error=${encodeURIComponent(msg)}`);
  }
  const { data: ws } = await supabase.from("workspaces").select("slug").eq("id", workspaceId as string).single();
  redirect(ws ? `/w/${ws.slug}` : "/app");
}
