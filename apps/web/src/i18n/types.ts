import type { ScopedT } from "./translate";
import type { Messages } from "./messages/en";

/** The translator for one section, for passing into helpers: `(t: TFor<"inbox">)`. */
export type TFor<P extends keyof Messages> = ScopedT<Messages[P]>;
export type { Translator } from "./translate";
export type { Format } from "./format";
