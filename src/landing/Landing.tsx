import { useEffect, useState } from "react";
import { Button, LoadingScreen, P, colors, flex, shadow, text } from "maui";
import { style, useStyles } from "purse-styles";
import { fetchGitHubChanges } from "../github/fetchRepo.ts";
import { HostFilesContext } from "../host/files.ts";
import {
  SESSION_STORE_REV,
  sessionStoreChanges,
  sessionStoreFiles,
} from "../host/sessionStorePr.ts";
import { GistStatus } from "../gist/GistStatus.tsx";
import {
  ChangesLoaderContext,
  type ChangesLoader,
} from "../viewer/changesSource.ts";
import { CommentsContext, useCommentStore } from "../viewer/comments.ts";
import { ViewerModeContext } from "../viewer/viewerMode.ts";
import { CodeNavigationProvider, useSpecViews } from "./shared.tsx";
import { ShowcaseVariant } from "./ShowcaseVariant.tsx";
import { ContrastVariant } from "./ContrastVariant.tsx";
import { TimelineVariant } from "./TimelineVariant.tsx";

const variants = [
  { id: "a", label: "A · Showcase" },
  { id: "b", label: "B · Before / after" },
  { id: "c", label: "C · Timeline" },
] as const;
type VariantId = (typeof variants)[number]["id"];

const loadChanges: ChangesLoader = (rev) =>
  rev === SESSION_STORE_REV
    ? Promise.resolve(sessionStoreChanges)
    : fetchGitHubChanges({ owner: "tanishqkancharla", repo: "diffmap" }, rev);

function readVariant(): VariantId {
  const value = new URLSearchParams(window.location.search).get("v");
  return variants.find((variant) => variant.id === value)?.id ?? "a";
}

export function Landing() {
  const [variant, setVariant] = useState(readVariant);
  const views = useSpecViews();
  const comments = useCommentStore("diffmap-comments:landing");

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("v", variant);
    window.history.replaceState({}, "", url);
    window.scrollTo({ top: 0 });
  }, [variant]);

  if (views === undefined) return <LoadingScreen />;
  if (views instanceof Error)
    return (
      <GistStatus title="Could not parse the examples">
        <P>{views.message}</P>
      </GistStatus>
    );

  return (
    <ViewerModeContext.Provider value="host">
      <CommentsContext.Provider value={comments}>
        <HostFilesContext.Provider value={sessionStoreFiles}>
          <ChangesLoaderContext.Provider value={loadChanges}>
            {/* A new provider per variant so a clicked reference does not follow you between directions. */}
            <CodeNavigationProvider key={variant}>
              {variant === "a" && <ShowcaseVariant views={views} />}
              {variant === "b" && <ContrastVariant views={views} />}
              {variant === "c" && <TimelineVariant views={views} />}
            </CodeNavigationProvider>
            <VariantSwitcher value={variant} onChange={setVariant} />
          </ChangesLoaderContext.Provider>
        </HostFilesContext.Provider>
      </CommentsContext.Provider>
    </ViewerModeContext.Provider>
  );
}

/** Prototype-only: flips between the three directions. */
function VariantSwitcher(props: {
  value: VariantId;
  onChange: (value: VariantId) => void;
}) {
  const bar = useStyles(styles.switcher);
  const label = useStyles(styles.switcherLabel);
  return (
    <div className={bar} role="group" aria-label="Design direction">
      <span className={label}>Direction</span>
      {variants.map((variant) => (
        <Button
          key={variant.id}
          size="sm"
          variant={variant.id === props.value ? "default" : "quiet"}
          aria-pressed={variant.id === props.value}
          onPress={() => props.onChange(variant.id)}
        >
          {variant.label}
        </Button>
      ))}
    </div>
  );
}

const styles = {
  switcher: style(
    flex({ direction: "row", alignItems: "center", gap: 2 }),
    shadow.strong,
    {
      position: "fixed",
      left: "50%",
      bottom: "16px",
      transform: "translateX(-50%)",
      zIndex: 30,
      padding: "4px 4px 4px 12px",
      borderRadius: "999px",
      backgroundColor: colors.gray[1],
      whiteSpace: "nowrap",
    },
  ),
  switcherLabel: style(
    text({ size: "xs", fontWeight: 500, color: "lowContrast" }),
    {
      marginRight: "4px",
    },
  ),
};
