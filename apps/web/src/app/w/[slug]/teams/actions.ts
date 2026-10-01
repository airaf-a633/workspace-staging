"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { loadWorkspace } from "@/lib/workspace";

/* Errors go back as codes (teamsPage.errors.<code>) so the page words them in the reader's language. */
function back(slug: string, code: string): never {
  redirect(`/w/${slug}/teams?error=${code}`);
}
const name = z.string().trim().min(1, "needName").max(60, "needName");

export async function createTeam(form: FormData) {
  const slug = String(form.get("slug"));
  const { supabase, workspace } = await loadWorkspace(slug);
  const n = name.safeParse(form.get("name"));
  if (!n.success) back(slug, n.error.issues[0]!.message);
  const { error } = await supabase.from("teams").insert({ workspace_id: workspace.id, name: n.data, is_branch: form.get("isBranch") === "on" });
  if (error) back(slug, error.code === "23505" ? "duplicate" : "ownerCreate");
  redirect(`/w/${slug}/teams`);
}

export async function updateTeam(form: FormData) {
  const slug = String(form.get("slug"));
  const { supabase } = await loadWorkspace(slug);
  const id = z.uuid().parse(form.get("teamId"));
  const n = name.safeParse(form.get("name"));
  if (!n.success) back(slug, n.error.issues[0]!.message);
  const { data, error } = await supabase.from("teams").update({ name: n.data, is_branch: form.get("isBranch") === "on" }).eq("id", id).select("id");
  if (error || !data?.length) back(slug, error?.code === "23505" ? "duplicate" : "onlyYours");
  redirect(`/w/${slug}/teams`);
}

export async function deleteTeam(form: FormData) {
  const slug = String(form.get("slug"));
  const { supabase } = await loadWorkspace(slug);
  const id = z.uuid().parse(form.get("teamId"));
  const { data, error } = await supabase.from("teams").delete().eq("id", id).select("id");
  if (error || !data?.length) back(slug, "ownerDelete");
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
  if (error) back(slug, error.code === "23505" ? "alreadyIn" : "ownerMembers");
  redirect(`/w/${slug}/teams`);
}
