import { createContext, useContext, useEffect, useState } from "react";
import type { ConfigLoad, DeploymentTarget } from "../../diffmapConfig.js";

export type { ConfigLoad };

/** Where preview and flow blocks read `.diffmap/config.json`, and, on diffmap.dev, the pull request that fills `previews.preview`. */
export type PreviewsSource = {
  load: () => Promise<ConfigLoad>;
  deployment?: DeploymentTarget;
};

let served: Promise<ConfigLoad> | undefined;

/** `serve`'s reading of `.diffmap/config.json`, fetched once per page. */
const servedConfig: PreviewsSource = {
  load: () =>
    (served ??= fetch("/__diffmap/config").then(
      // SAFETY: `serve` answers with this shape.
      async (response) => (await response.json()) as ConfigLoad,
      (error: unknown) => ({ error: String(error) }),
    )),
};

export const PreviewsSourceContext =
  createContext<PreviewsSource>(servedConfig);

export function usePreviewsSource() {
  return useContext(PreviewsSourceContext);
}

export function useDiffmapConfig() {
  const { load } = usePreviewsSource();
  const [config, setConfig] = useState<ConfigLoad | undefined>(undefined);
  useEffect(() => {
    let current = true;
    void load().then((next) => {
      if (current) setConfig(next);
    });
    return () => {
      current = false;
    };
  }, [load]);
  return config;
}

/** Storybook shows an export like `WrongPassword` as "Wrong Password". */
export function storyLabel(name: string) {
  return name
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .replace(/^./, (first) => first.toUpperCase());
}

/** Before the page answers, a story's ID is all there is: `auth-log-in--wrong-password` reads "Wrong Password". */
export function storyLabelFromId(id: string) {
  return id
    .slice(id.indexOf("--") + 2)
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
