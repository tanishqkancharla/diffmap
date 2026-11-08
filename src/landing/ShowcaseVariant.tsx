import { useEffect } from "react";
import { flex } from "maui";
import { style, useStyles } from "purse-styles";
import { Mesh, glassCode, headerBlobs } from "./Mesh.tsx";
import { MeshFooter } from "./MeshFooter.tsx";
import { ScrollDemo } from "./ScrollDemo.tsx";
import {
  DiffHeadline,
  Nav,
  SpecFence,
  PROMPT_WIDTH,
  styles as shared,
  type SpecViews,
} from "./shared.tsx";

/**
 * Direction A: the product is the hero. A big headline, one prompt to copy,
 * then a browser window whose spec you scroll through, with callouts beside it.
 */
export function ShowcaseVariant(props: { views: SpecViews }) {
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
            <SpecFence fence={props.views.branchPrompt} />
          </div>
        </header>
      </div>

      <ScrollDemo document={props.views.demo} />

      <MeshFooter prompt={props.views.branchPrompt} />
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
