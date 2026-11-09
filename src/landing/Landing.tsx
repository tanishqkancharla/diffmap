import { useEffect } from "react";
import { LoadingScreen, P, flex } from "maui";
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
import { Mesh, glassCode, headerBlobs } from "./Mesh.tsx";
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
export function Landing() {
  const demo = useDemo();
  const comments = useCommentStore("diffmap-comments:landing");

  if (demo === undefined) return <LoadingScreen />;
  if (demo instanceof Error)
    return (
      <GistStatus title="Could not parse the demo">
        <P>{demo.message}</P>
      </GistStatus>
    );

  return (
    <ViewerModeContext.Provider value="host">
      <CommentsContext.Provider value={comments}>
        <HostFilesContext.Provider value={sessionStoreFiles}>
          <ChangesLoaderContext.Provider value={loadChanges}>
            <LandingPage demo={demo} />
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
function LandingPage(props: { demo: ViewerDocument }) {
  const page = useStyles(shared.page);
  const container = useStyles(shared.container);
  const heroBand = useStyles(styles.heroBand);
  const hero = useStyles(styles.hero);
  const lede = useStyles(shared.lede, styles.ledeWidth);
  const cta = useStyles(styles.cta);
  const ctaLabel = useStyles(shared.label);
  // The demo's viewer names the tab after its spec; this page keeps its own.
  useEffect(() => {
    document.title = "diffmap";
  }, []);

  return (
    <div className={page} id="top">
      <Nav />
      <div className={heroBand}>
        {/* Fades out at both edges, so the nav and the demo sit on plain page. */}
        <Mesh
          blobs={headerBlobs}
          mask="linear-gradient(to bottom, transparent, black 18%, black 70%, transparent)"
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

      <MeshFooter />
    </div>
  );
}

const styles = {
  // Full width behind the hero, so the mesh runs edge to edge.
  heroBand: style({ position: "relative", overflow: "hidden" }),
  hero: style(flex({ direction: "column", alignItems: "center", gap: 12 }), {
    position: "relative",
    paddingTop: "64px",
    paddingBottom: "24px",
    textAlign: "center",
  }),
  ledeWidth: style({ maxWidth: "620px" }),
  cta: style(
    glassCode,
    flex({ direction: "column", alignItems: "center", gap: 3 }),
    {
      width: "100%",
      maxWidth: PROMPT_WIDTH,
      marginTop: "12px",
    },
  ),
};
