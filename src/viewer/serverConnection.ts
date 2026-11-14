import { useSyncExternalStore } from "react";

/** The local server's state as the viewer sees it. `closed` is a reader pressing Close server, which is not a failure. */
export type ServerConnection = "connected" | "disconnected" | "closed";

let connection: ServerConnection = "connected";
const listeners = new Set<() => void>();

export function setServerConnection(next: ServerConnection) {
  if (connection === "closed" || connection === next) return;
  connection = next;
  for (const listener of listeners) listener();
}

export function useServerConnection() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => connection,
  );
}
