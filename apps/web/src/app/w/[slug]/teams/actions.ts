"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { loadWorkspace } from "@/lib/workspace";

function back(slug: string, msg: string): never {
  redirect(`/w/${slug}/teams?error=${encodeURIComponent(msg)}`);
}
const name = z.string().trim().min(1, "Name the team.").max(60);

export async function createTeam(form: FormData) {
  const slug = String(form.get("slug"));
  const { supabase, workspace } = await loadWorkspace(slug);
  const n = name.safeParse(form.get("name"));
  if (!n.success) back(slug, n.error.issues[0]!.message);
  const { error } = await supabase.from("teams").insert({ workspace_id: workspace.id, name: n.data, is_branch: form.get("isBranch") === "on" });
  if (error) back(slug, error.code === "23505" ? "A team with that name already exists." : "Only the owner can create teams.");
  redirect(`/w/${slug}/teams`);
}

export async function updateTeam(form: FormData) {
  const slug = String(form.get("slug"));
  const { supabase } = await loadWorkspace(slug);
  const id = z.uuid().parse(form.get("teamId"));
  const n = name.safeParse(form.get("name"));
  if (!n.success) back(slug, n.error.issues[0]!.message);
  const { data, error } = await supabase.from("teams").update({ name: n.data, is_branch: form.get("isBranch") === "on" }).eq("id", id).select("id");
  if (error || !data?.length) back(slug, error?.code === "23505" ? "A team with that name already exists." : "You can only change teams you manage.");
  redirect(`/w/${slug}/teams`);
}

export async function deleteTeam(form: FormData) {
  const slug = String(form.get("slug"));
  const { supabase } = await loadWorkspace(slug);
  const id = z.uuid().parse(form.get("teamId"));
  const { data, error } = await supabase.from("teams").delete().eq("id", id).select("id");
  if (error || !data?.length) back(slug, "Only the owner can delete teams, and the default team can't be deleted.");
  redirect(`/w/${slug}/teams`);
}

export async function setTeamMember(form: FormData) {
  const slug = String(form.get("slug"));
  const { supabase, workspace } = await loadWorkspace(slug);
  const teamId = z.uuid().parse(form.get("teamId"));
  const memberId = z.uuid().parse(form.get("memberId"));
  const { error } =
    form.get("op") === "remove"
      ? await supabase.from("team_members").delete().eq("team_id", teamId).eq("member_id", memberId)
      : await supabase.from("team_members").insert({ workspace_id: workspace.id, team_id: teamId, member_id: memberId });
  if (error) back(slug, error.code === "23505" ? "They're already in that team." : "Only the owner can change who is in a team.");
  redirect(`/w/${slug}/teams`);
}
