"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { loadWorkspace } from "@/lib/workspace";

/** Turns the pending Microsoft sign-in into an email channel for the chosen mailbox (own or shared). */
export async function finishOutlook(data: FormData) {
  const slug = String(data.get("slug"));
  const pending = z.uuid().parse(data.get("pending"));
  const { supabase } = await loadWorkspace(slug);
  const which = data.get("which") === "shared" ? "shared" : "own";
  const mailbox = String(which === "shared" ? data.get("shared") ?? "" : data.get("own") ?? "").trim().toLowerCase();
  const name = String(data.get("name") ?? "").trim();
  const back = (error: string) => redirect(`/w/${slug}/channels/new/outlook?pending=${pending}&error=${error}`);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mailbox)) back("badAddress");
  if (!name) back("needName");

  const { data: id, error } = await supabase.rpc("finish_outlook_channel", { p_pending: pending, p_mailbox: mailbox, p_name: name });
  if (error) {
    const m = error.message;
    redirect(`/w/${slug}/channels/new/outlook?error=${m.includes("expired") ? "expired" : m.includes("already_connected") ? "alreadyConnected" : m.includes("not_allowed") ? "notAllowed" : "failed"}`);
  }
  redirect(`/w/${slug}/channels/${id}?created=1`);
}
