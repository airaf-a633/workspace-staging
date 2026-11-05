import { Submit } from "@/components/ui/submit";
import { getT } from "@/i18n/server";

/** What a business sets for an email channel: its address, the name replies come from, and a signature. */
export async function EmailForm({
  action,
  slug,
  id,
  initial,
  submit,
  disabled = false,
}: {
  action: (data: FormData) => Promise<void>;
  slug: string;
  id?: string;
  initial: { name: string; address: string; fromName: string; signature: string };
  submit: string;
  disabled?: boolean;
}) {
  const t = await getT("emailSetup");
  const field = "min-h-11 rounded-[var(--radius-control)] border border-input bg-surface px-3 font-normal disabled:opacity-60";
  return (
    <form action={action} className="grid gap-4 sm:max-w-lg">
      <input type="hidden" name="slug" value={slug} />
      {id && <input type="hidden" name="id" value={id} />}
      <fieldset disabled={disabled} className="grid gap-4">
        <label className="grid gap-1.5 text-sm font-medium">
          {t("address")}
          <input name="address" type="email" defaultValue={initial.address} required placeholder="support@yourbusiness.com" dir="ltr" className={field} />
          <span className="text-xs font-normal text-muted">{t("addressHelp")}</span>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {t("name")}
          <input name="name" defaultValue={initial.name} required maxLength={80} className={field} />
          <span className="text-xs font-normal text-muted">{t("nameHelp")}</span>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {t("fromName")}
          <input name="fromName" defaultValue={initial.fromName} maxLength={80} placeholder={t("fromNamePlaceholder")} className={field} />
          <span className="text-xs font-normal text-muted">{t("fromNameHelp")}</span>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {t("signature")}
          <textarea name="signature" defaultValue={initial.signature} rows={3} maxLength={1000} placeholder={t("signaturePlaceholder")} className={`${field} py-2`} />
        </label>
      </fieldset>
      {!disabled && <div><Submit>{submit}</Submit></div>}
    </form>
  );
}
