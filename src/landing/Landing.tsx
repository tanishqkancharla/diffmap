import { Badge, P, bannerStyles, colors, flex, focusRing } from "maui";
import { Link } from "react-aria-components";
import { style, useStyles } from "purse-styles";
import { fetchGitHubChanges } from "../github/fetchRepo.ts";
import { SpecErrorPage } from "../viewer/StatusPage.tsx";
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
      <SpecErrorPage
        title="The demo has an error"
        file="demo.md"
        message={demo.message}
      >
        <P>diffmap.dev's own example walkthrough didn't parse.</P>
      </SpecErrorPage>
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
  const announcement = useStyles(styles.announcement);
  const announcementBanner = useStyles(styles.announcementBanner);
  const announcementBadge = useStyles(styles.announcementBadge);
  const showAnnouncement =
    ["/", "/index.html"].includes(window.location.pathname) &&
    !["productdoc.dev", "www.productdoc.dev"].includes(
      window.location.hostname,
    );

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
          {showAnnouncement && (
            <aside className={announcement} aria-label="About Productdoc">
              <Link
                className={announcementBanner}
                href="https://productdoc.dev"
              >
                <Badge className={announcementBadge}>New</Badge>
                <span>
                  Diffmap is growing into{" "}
                  <strong>
                    Productdoc <span aria-hidden="true">→</span>
                  </strong>
                </span>
              </Link>
            </aside>
          )}
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

      <ScrollDemo document={props.demo} showDiffButton />

      <MeshFooter blobs={props.mesh?.footer} />
    </div>
  );
}

const styles = {
  announcement: style({ maxWidth: "100%", marginBottom: "4px" }),
  announcementBanner: style(bannerStyles.root({ tone: "info" }), focusRing(), {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    maxWidth: "100%",
    padding: "4px 12px 4px 4px",
    borderRadius: "999px",
    backgroundColor: colors.blue[3],
    borderColor: colors.blue[7],
    color: colors.blue[12],
    fontSize: "14px",
    lineHeight: "20px",
    textDecoration: "none",
    textWrap: "balance",
    "& strong": { fontWeight: 600, whiteSpace: "nowrap" },
    "&[data-hovered] strong": {
      textDecoration: "underline",
      textUnderlineOffset: "3px",
    },
  }),
  announcementBadge: style({
    flexShrink: 0,
    height: "auto",
    padding: "1px 8px",
    backgroundColor: colors.blue[11],
    color: colors.blue[1],
    fontWeight: 600,
    lineHeight: "18px",
  }),
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
    opacity: 1,
    "@supports (mix-blend-mode: plus-darker)": {
      mixBlendMode: "plus-darker",
      opacity: 0.8,
    },
    '&:is(:root[data-theme="dark"] *)': {
      mixBlendMode: "plus-lighter",
      opacity: 0.8,
    },
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
