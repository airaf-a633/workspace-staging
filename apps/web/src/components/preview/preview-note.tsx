import { getT } from "@/i18n/server";

/** Shown on preview screens with forms: everything looks real, nothing can be changed. One quiet line, not a banner. */
export async function PreviewNote() {
  const t = await getT("preview");
  return <p className="text-sm text-muted sm:w-auto">{t("changesOff")}</p>;
}
