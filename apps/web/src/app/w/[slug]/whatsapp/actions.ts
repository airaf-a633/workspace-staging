"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { GraphError, getPhoneNumber, subscribeApp } from "@app/whatsapp";
import { serverEnv } from "@/env";
import { loadWorkspace } from "@/lib/workspace";

/*
 * Connect Meta's test number (M2.2, decided 2026-10-02). The owner pastes the number ID, the WhatsApp
 * Business Account ID and an access token; we check them with Meta, subscribe our app to the account's
 * webhooks, then store the token in Vault. Embedded Signup replaces this form in M2.8.
 * Errors go back as codes (numbers.errors.<code>); the token never appears in a URL or a log.
 */
const digits = z.string().trim().regex(/^[0-9]{5,25}$/);

export async function connectTestNumber(form: FormData) {
  const slug = String(form.get("slug"));
  const back = (code: string): never => redirect(`/w/${slug}/whatsapp?error=${code}`);
  const { supabase, workspace } = await loadWorkspace(slug);

  const parsed = z
    .object({ phoneNumberId: digits, wabaId: digits, token: z.string().trim().min(20).max(1000) })
    .safeParse({ phoneNumberId: form.get("phoneNumberId"), wabaId: form.get("wabaId"), token: form.get("token") });
  if (!parsed.success) back("invalidFields");
  const { phoneNumberId, wabaId, token } = parsed.data!;
  const version = serverEnv().WHATSAPP_API_VERSION;

  let number: Awaited<ReturnType<typeof getPhoneNumber>>;
  try {
    number = await getPhoneNumber(version, phoneNumberId, token);
    await subscribeApp(version, wabaId, token);
  } catch (e) {
    back(e instanceof GraphError && (e.status === 401 || e.code === 190) ? "badToken" : e instanceof GraphError && e.status === 400 ? "notFound" : "metaDown");
  }

  const { error } = await supabase.rpc("connect_whatsapp_account", {
    p_workspace: workspace.id,
    p_waba_id: wabaId,
    p_phone_number_id: phoneNumberId,
    p_display_phone: number!.display_phone_number,
    p_verified_name: number!.verified_name ?? null,
    p_quality: number!.quality_rating ?? null,
    p_token: token,
    p_is_test: true,
  });
  if (error) back(error.code === "42501" ? "ownerOnly" : error.code === "23505" ? "taken" : "saveFailed");
  redirect(`/w/${slug}/whatsapp?connected=1`);
}
