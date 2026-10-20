"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { publicEnv } from "@/lib/public-env";
import { loadWorkspace } from "@/lib/workspace";

/* Errors go back as codes (members.errors.<code>): the page words them, and nothing personal lands in the URL. */
function back(slug: string, code: string): never {
  redirect(`/w/${slug}/members?error=${code}`);
}

export async function inviteMember(form: FormData) {
  const slug = String(form.get("slug"));
  const { supabase, workspace } = await loadWorkspace(slug);
  const parsed = z
    .object({ email: z.email("invalidEmail"), roleId: z.uuid("chooseRole"), teamIds: z.array(z.uuid()) })
    .safeParse({ email: form.get("email"), roleId: form.get("role"), teamIds: form.getAll("team") });
  if (!parsed.success) back(slug, parsed.error.issues[0]!.message);

  const { data: token, error } = await supabase.rpc("create_invite", {
    p_workspace: workspace.id,
    p_email: parsed.data.email,
    p_role: parsed.data.roleId,
    p_team_ids: parsed.data.teamIds,
  });
  if (error || typeof token !== "string") back(slug, error?.code === "42501" ? "ownerInvite" : "inviteFailed");

  // Show the link once, then forget it. Only its hash is stored in the database.
  const store = await cookies();
  const once = { httpOnly: true, sameSite: "strict" as const, maxAge: 120, path: `/w/${slug}/members` };
  store.set("invite_link", `${publicEnv().siteUrl}/invite/${token}`, once);
  // The email rides in the same short-lived cookie, not the URL (no personal data in URLs).
  store.set("invite_email", parsed.data.email, once);
  redirect(`/w/${slug}/members?invited=1`);
}

export async function revokeInvite(form: FormData) {
  const slug = String(form.get("slug"));
  const { supabase } = await loadWorkspace(slug);
  const id = z.uuid().safeParse(form.get("inviteId"));
  if (!id.success) back(slug, "inviteGone");
  const { error } = await supabase.from("invites").delete().eq("id", id.data);
  if (error) back(slug, "ownerCancel");
  redirect(`/w/${slug}/members`);
}

export async function removeMember(form: FormData) {
  const slug = String(form.get("slug"));
  const { supabase, me } = await loadWorkspace(slug);
  const id = z.uuid().safeParse(form.get("memberId"));
  if (!id.success) back(slug, "memberGone");
  if (id.data === me.id) back(slug, "removeSelf");

  // Reassigning chats, deals and tasks joins this step when those exist (M2, M3).
  const { error } = await supabase
    .from("members")
    .update({ status: "removed", removed_at: new Date().toISOString() })
    .eq("id", id.data);
  if (error) back(slug, error.message.includes("at least one owner") ? "keepOwner" : "ownerRemove");
  redirect(`/w/${slug}/members`);
}

export async function changeRole(form: FormData) {
  const slug = String(form.get("slug"));
  const { supabase } = await loadWorkspace(slug);
  const memberId = z.uuid().parse(form.get("memberId"));
  const roleId = z.uuid().parse(form.get("roleId"));
  const { error } = await supabase.from("members").update({ role_id: roleId }).eq("id", memberId);
  if (error) back(slug, error.message.includes("at least one owner") ? "keepOwner" : "ownerRoles");
  redirect(`/w/${slug}/members`);
}
