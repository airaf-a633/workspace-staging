"use client";

import type { ComponentProps } from "react";
import { addCustomer, bulkCustomers, patchCustomer, pinCustomerNote } from "@/app/w/[slug]/customers/actions";
import { CustomerList } from "./customer-list";
import { CustomerPage } from "./customer-page";

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
      }}
    />
  );
}
