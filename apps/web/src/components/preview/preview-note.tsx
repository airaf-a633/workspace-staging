import { Notice } from "@/components/ui/surface";

/** Shown on preview screens with forms: everything looks real, nothing can be changed. */
export function PreviewNote() {
  return <Notice tone="info" title="Changes are turned off in the preview">Sign up to set up your own workspace.</Notice>;
}
