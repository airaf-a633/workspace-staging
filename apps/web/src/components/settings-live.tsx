"use client";

import type { ComponentProps } from "react";
import { deleteLabel, saveContactFields, saveLabel } from "@/app/w/[slug]/customers/actions";
import { ContactSettings } from "@/components/customers/contact-settings";
import { LabelsSettings } from "@/components/labels/labels-settings";

/** Settings › Labels and Settings › Contacts in a real workspace: the preview's screens, saving for real. */
export function LabelsSettingsLive({ slug, ...props }: Omit<ComponentProps<typeof LabelsSettings>, "saveTo"> & { slug: string }) {
  return <LabelsSettings {...props} saveTo={{ save: (id, name, color) => saveLabel(slug, id, name, color), remove: (id) => deleteLabel(slug, id) }} />;
}

export function ContactSettingsLive({ slug, ...props }: Omit<ComponentProps<typeof ContactSettings>, "saveFields"> & { slug: string }) {
  return <ContactSettings {...props} saveFields={(defs) => saveContactFields(slug, defs.map((d) => ({ key: d.key, label: d.label, type: d.type, options: d.options })))} />;
}
