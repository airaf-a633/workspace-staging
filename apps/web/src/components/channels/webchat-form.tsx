import { Submit } from "@/components/ui/submit";
import { getT } from "@/i18n/server";

/** The few things a business sets for website chat; everything else has a sensible default. */
export async function WebchatForm({
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
  initial: { name: string; site: string; color: string; greeting: string; position: "left" | "right" };
  submit: string;
  disabled?: boolean;
}) {
  const t = await getT("webchatSetup");
  const field = "min-h-11 rounded-[var(--radius-control)] border border-input bg-surface px-3 font-normal disabled:opacity-60";
  return (
    <form action={action} className="grid gap-4 sm:max-w-lg">
      <input type="hidden" name="slug" value={slug} />
      {id && <input type="hidden" name="id" value={id} />}
      <fieldset disabled={disabled} className="grid gap-4">
        <label className="grid gap-1.5 text-sm font-medium">
          {t("name")}
          <input name="name" defaultValue={initial.name} required maxLength={80} className={field} />
          <span className="text-xs font-normal text-muted">{t("nameHelp")}</span>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {t("site")}
          <input name="site" defaultValue={initial.site} placeholder="example.com" dir="ltr" maxLength={200} className={field} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {t("greeting")}
          <input name="greeting" defaultValue={initial.greeting} placeholder={t("greetingPlaceholder")} maxLength={280} className={field} />
        </label>
        <div className="flex flex-wrap gap-6">
          <label className="grid gap-1.5 text-sm font-medium">
            {t("color")}
            <input type="color" name="color" defaultValue={initial.color} className="h-11 w-20 rounded-[var(--radius-control)] border border-input bg-surface p-1" />
          </label>
          <fieldset className="grid gap-1.5 text-sm">
            <legend className="mb-1.5 font-medium">{t("position")}</legend>
            <div className="flex gap-4">
              {(["right", "left"] as const).map((p) => (
                <label key={p} className="flex min-h-11 items-center gap-2">
                  <input type="radio" name="position" value={p} defaultChecked={initial.position === p} className="size-4 accent-[var(--primary)]" />
                  {t(`positions.${p}`)}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </fieldset>
      {!disabled && <div><Submit>{submit}</Submit></div>}
    </form>
  );
}
