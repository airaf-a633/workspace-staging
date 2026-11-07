import type { ChannelModule } from "./types";

/** Every credential-based channel the worker can handle, by channel type. Modules register here as they are built. */
export const MODULES: Record<string, ChannelModule> = {};

export function register(module: ChannelModule) {
  MODULES[module.type] = module;
}
