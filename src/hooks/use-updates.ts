import { useSyncExternalStore } from "react";
import { getUpdateState, subscribeUpdates } from "@/lib/updates";

/** What is known about a newer version (see src/lib/updates.ts). */
export const useUpdates = () => useSyncExternalStore(subscribeUpdates, getUpdateState);
