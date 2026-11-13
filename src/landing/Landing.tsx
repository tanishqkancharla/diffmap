import { P, flex } from "maui";
import { style, useStyles } from "purse-styles";
import { fetchGitHubChanges } from "../github/fetchRepo.ts";
import { GistStatus } from "../gist/GistStatus.tsx";
import { HostFilesContext } from "../host/files.ts";
import {
  SESSION_STORE_REV,
  sessionStoreChanges,
  sessionStoreFiles,
} from "../host/sessionStorePr.ts";
import {
  ChangesLoaderContext,
  type ChangesLoader,
} from "../viewer/changesSource.ts";
import { CommentsContext, useCommentStore } from "../viewer/comments.ts";
import { ViewerModeContext } from "../viewer/viewerMode.ts";
import { Mesh, promptCode, headerBlobs, type Blob } from "./Mesh.tsx";
import { MeshFooter } from "./MeshFooter.tsx";
import { ScrollDemo } from "./ScrollDemo.tsx";
import {
  BranchPrompt,
  DiffHeadline,
  Nav,
  PROMPT_WIDTH,
  styles as shared,
  useDemo,
} from "./shared.tsx";
import type { ViewerDocument } from "../parseViewer.ts";

/** The example pull request is served here; diffmap's own commits are read from GitHub. */
const loadChanges: ChangesLoader = (rev) =>
  rev === SESSION_STORE_REV
    ? Promise.resolve(sessionStoreChanges)
    : fetchGitHubChanges({ owner: "tanishqkancharla", repo: "diffmap" }, rev);

/** diffmap.dev's homepage. */
export function Landing(props: { mesh?: { header: Blob[]; footer: Blob[] } }) {
  const demo = useDemo();
  const comments = useCommentStore("diffmap-comments:landing");

  if (demo instanceof Error)
    return (
      <GistStatus title="Could not parse the demo">
        <P>{demo.message}</P>
      </GistStatus>
    );

  // The page draws before the demo is ready; the demo's window holds its place.
  return (
    <ViewerModeContext.Provider value="host">
      <CommentsContext.Provider value={comments}>
        <HostFilesContext.Provider value={sessionStoreFiles}>
          <ChangesLoaderContext.Provider value={loadChanges}>
            <LandingPage demo={demo} mesh={props.mesh} />
          </ChangesLoaderContext.Provider>
        </HostFilesContext.Provider>
      </CommentsContext.Provider>
    </ViewerModeContext.Provider>
  );
}

/**
 * The product is the hero: a big headline, one prompt to copy, then a
 * browser window whose spec you scroll through, with callouts beside it.
 */
function LandingPage(props: {
  demo: ViewerDocument | undefined;
  mesh?: { header: Blob[]; footer: Blob[] };
}) {
  const page = useStyles(shared.page);
  const container = useStyles(shared.container);
  const heroBand = useStyles(styles.heroBand);
  const hero = useStyles(styles.hero);
  const lede = useStyles(shared.lede, styles.ledeWidth);
  const cta = useStyles(styles.cta);
  const ctaLabel = useStyles(shared.label);

  return (
    <div className={page} id="top">
      <Nav />
      <div className={heroBand}>
        {/* Color falls from the header's top edge and fades before the demo. */}
        <Mesh
          blobs={props.mesh?.header ?? headerBlobs}
          edge="top"
          mask="linear-gradient(to bottom, black, black 35%, transparent)"
        />
        <header className={`${container} ${hero}`}>
          <DiffHeadline
            before="Review the"
            removed="line diff"
            added="design."
          />
          <p className={lede}>
            Your coding agent writes more code than you can review. diffmap has
            it explain each change with interactive diagrams, linked to the code
            they touch.
          </p>
          <div className={cta}>
            <span className={ctaLabel}>
              Paste this into your agent on any branch
            </span>
            <BranchPrompt />
          </div>
        </header>
      </div>

      <ScrollDemo document={props.demo} />

      <MeshFooter blobs={props.mesh?.footer} />
    </div>
  );
}

const styles = {
  // Full width behind the hero, so the mesh runs edge to edge.
  heroBand: style({
    position: "relative",
    overflow: "hidden",
  }),
  hero: style(flex({ direction: "column", alignItems: "center", gap: 12 }), {
    position: "relative",
    paddingTop: "64px",
    paddingBottom: "24px",
    textAlign: "center",
  }),
  ledeWidth: style({
    maxWidth: "620px",
    mixBlendMode: "multiply",
    opacity: 0.8,
    '&:is(:root[data-theme="dark"] *)': { mixBlendMode: "plus-lighter" },
  }),
  cta: style(
    promptCode,
    flex({ direction: "column", alignItems: "center", gap: 3 }),
    {
      width: "100%",
      maxWidth: PROMPT_WIDTH,
      marginTop: "12px",
    },
  ),
};
