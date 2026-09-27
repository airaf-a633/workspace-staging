"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { publicEnv } from "@/lib/public-env";
import { loadWorkspace } from "@/lib/workspace";

function back(slug: string, msg: string): never {
  redirect(`/w/${slug}/members?error=${encodeURIComponent(msg)}`);
}

export async function inviteMember(form: FormData) {
  const slug = String(form.get("slug"));
  const { supabase, workspace } = await loadWorkspace(slug);
  const parsed = z
    .object({ email: z.email("Enter a valid email address."), roleId: z.uuid("Choose a role."), teamIds: z.array(z.uuid()) })
    .safeParse({ email: form.get("email"), roleId: form.get("role"), teamIds: form.getAll("team") });
  if (!parsed.success) back(slug, parsed.error.issues[0]!.message);

  const { data: token, error } = await supabase.rpc("create_invite", {
    p_workspace: workspace.id,
    p_email: parsed.data.email,
    p_role: parsed.data.roleId,
    p_team_ids: parsed.data.teamIds,
  });
  if (error || typeof token !== "string") back(slug, error?.code === "42501" ? "Only the owner can invite members." : "Couldn't create the invite. Try again.");

  // Show the link once, then forget it. Only its hash is stored in the database.
  const store = await cookies();
  store.set("invite_link", `${publicEnv().siteUrl}/invite/${token}`, { httpOnly: true, sameSite: "strict", maxAge: 120, path: `/w/${slug}/members` });
  redirect(`/w/${slug}/members?invited=${encodeURIComponent(parsed.data.email)}`);
}

export async function revokeInvite(form: FormData) {
  const slug = String(form.get("slug"));
  const { supabase } = await loadWorkspace(slug);
  const id = z.uuid().safeParse(form.get("inviteId"));
  if (!id.success) back(slug, "That invite no longer exists.");
  const { error } = await supabase.from("invites").delete().eq("id", id.data);
  if (error) back(slug, "Only the owner can cancel invites.");
  redirect(`/w/${slug}/members`);
}

export async function removeMember(form: FormData) {
  const slug = String(form.get("slug"));
  const { supabase, me } = await loadWorkspace(slug);
  const id = z.uuid().safeParse(form.get("memberId"));
  if (!id.success) back(slug, "That member no longer exists.");
  if (id.data === me.id) back(slug, "You can't remove yourself. Ask another owner to do it.");

  // Reassigning chats, deals and tasks joins this step when those exist (M2, M3).
  const { error } = await supabase
    .from("members")
    .update({ status: "removed", removed_at: new Date().toISOString() })
    .eq("id", id.data);
  if (error) back(slug, error.message.includes("at least one owner") ? "A workspace must keep at least one owner." : "Only the owner can remove members.");
  redirect(`/w/${slug}/members`);
}

export async function changeRole(form: FormData) {
  const slug = String(form.get("slug"));
  const { supabase } = await loadWorkspace(slug);
  const memberId = z.uuid().parse(form.get("memberId"));
  const roleId = z.uuid().parse(form.get("roleId"));
  const { error } = await supabase.from("members").update({ role_id: roleId }).eq("id", memberId);
  if (error) back(slug, error.message.includes("at least one owner") ? "A workspace must keep at least one owner." : "Only the owner can change roles.");
  redirect(`/w/${slug}/members`);
}
