"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient, getUser } from "@/lib/supabase/server";

/* Errors go back as codes (invite.errors.<code>); the page words them and shows the signed-in email itself. */
export async function acceptInvite(form: FormData) {
  const token = String(form.get("token") ?? "");
  const here = `/invite/${encodeURIComponent(token)}`;
  const user = await getUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(here)}`);

  const name = z.string().trim().min(1).max(80).safeParse(form.get("name"));
  if (!name.success) redirect(`${here}?error=needName`);

  const supabase = await createClient();
  const { data: workspaceId, error } = await supabase.rpc("accept_invite", { p_token: token, p_display_name: name.data });
  if (error) {
    const code = error.code === "42501" ? "wrongEmail" : error.code === "23505" ? "alreadyMember" : "invalid";
    redirect(`${here}?error=${code}`);
  }
  const { data: ws } = await supabase.from("workspaces").select("slug").eq("id", workspaceId as string).single();
  redirect(ws ? `/w/${ws.slug}` : "/app");
}
