"use client";

import type { ComponentProps } from "react";
import {
  addCustomer, bulkCustomers, eraseCustomers, importCustomers, mergeCustomers, patchCustomer, pinCustomerNote, setConsent, setDoNotContact,
} from "@/app/w/[slug]/customers/actions";
import { CustomerList } from "./customer-list";
import { CustomerPage } from "./customer-page";
import { ImportFlow } from "./import-flow";
import { MergeCustomers } from "./merge-customers";

/**
 * The Contacts screens in a real workspace (decided 2026-10-20): the preview's components, with saving wired to
 * the workspace's server actions. The preview renders the components directly and saves nothing.
 */
export function CustomerListLive({ slug, ...props }: Omit<ComponentProps<typeof CustomerList>, "save"> & { slug: string }) {
  return (
    <CustomerList
      {...props}
      save={{
        add: (draft) => addCustomer(slug, draft),
        bulk: (kind, ids, value) => bulkCustomers(slug, kind, ids, value),
        erase: (ids) => eraseCustomers(slug, ids),
      }}
    />
  );
}

export function CustomerPageLive({ slug, ...props }: Omit<ComponentProps<typeof CustomerPage>, "save"> & { slug: string }) {
  return (
    <CustomerPage
      {...props}
      save={{
        patch: (id, patch) => patchCustomer(slug, id, patch),
        pin: (id, text) => pinCustomerNote(slug, id, text),
        consent: (id, channel, status) => setConsent(slug, id, channel, status),
        doNotContact: (id, on) => setDoNotContact(slug, id, on),
        erase: (id) => eraseCustomers(slug, [id]),
      }}
    />
  );
}

export function MergeCustomersLive({ slug, ...props }: Omit<ComponentProps<typeof MergeCustomers>, "onMerge"> & { slug: string }) {
  return <MergeCustomers {...props} onMerge={(take) => mergeCustomers(slug, props.a.id, props.b.id, take)} />;
}

export function ImportFlowLive({ slug, ...props }: Omit<ComponentProps<typeof ImportFlow>, "onImport"> & { slug: string }) {
  return <ImportFlow {...props} onImport={(rows) => importCustomers(slug, rows)} />;
}
