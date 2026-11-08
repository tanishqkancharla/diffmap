import { colors, flex, text } from "maui";
import { style, useStyles } from "purse-styles";
import type { Fence as FenceModel } from "../parseFence.ts";
import { Mesh, footerBlobs, glassCode } from "./Mesh.tsx";
import {
  DOCS_URL,
  GITHUB_URL,
  Logo,
  PROMPT_WIDTH,
  SpecFence,
} from "./shared.tsx";

/**
 * The page's last word: a diff's two colors as a grainy mesh gradient
 * around the tagline, red flowing up to the left and green down to the right.
 */
export function MeshFooter(props: { prompt: FenceModel }) {
  const root = useStyles(styles.root);
  const content = useStyles(styles.content);
  const brand = useStyles(styles.brand);
  const tagline = useStyles(styles.tagline);
  const prompt = useStyles(styles.prompt);
  const meta = useStyles(styles.meta);

  return (
    <footer className={root}>
      {/* Fades in from the page above, so the color has no hard top edge. */}
      <Mesh
        blobs={footerBlobs}
        mask="linear-gradient(to bottom, transparent, black 18%)"
        lamp
      />
      <div className={content}>
        <a className={brand} href="#top">
          <Logo size={32} />
          diffmap
        </a>
        <p className={tagline}>Review the design, not the line diff.</p>
        <div className={prompt}>
          <SpecFence fence={props.prompt} />
        </div>
        <div className={meta}>
          <a href={GITHUB_URL}>GitHub</a>
          <a href={DOCS_URL}>Docs</a>
          <span>Open source · MIT</span>
        </div>
      </div>
    </footer>
  );
}

const styles = {
  root: style({
    position: "relative",
    overflow: "hidden",
    marginTop: "24px",
    paddingInline: "24px",
    paddingTop: "160px",
    paddingBottom: "160px",
  }),
  content: style(flex({ direction: "column", alignItems: "center", gap: 6 }), {
    position: "relative",
    textAlign: "center",
  }),
  brand: style(flex({ direction: "row", alignItems: "center", gap: 4 }), {
    fontSize: "24px",
    fontWeight: 650,
    letterSpacing: "-0.02em",
    color: colors.gray[12],
    textDecoration: "none",
  }),
  tagline: style({
    margin: 0,
    fontSize: "clamp(28px, 4vw, 44px)",
    lineHeight: 1.1,
    letterSpacing: "-0.03em",
    fontWeight: 650,
    color: colors.gray[12],
    textWrap: "balance",
  }),
  prompt: style(
    glassCode,
    flex({ direction: "column", alignItems: "center" }),
    {
      width: "100%",
      maxWidth: PROMPT_WIDTH,
      marginTop: "20px",
    },
  ),
  meta: style(
    flex({ direction: "row", gap: 8, justifyContent: "center" }),
    text({ size: "xs", fontWeight: 500 }),
    {
      marginTop: "28px",
      flexWrap: "wrap",
      color: colors.gray[12],
      opacity: 0.75,
      "& a": { color: "inherit", textDecoration: "none" },
      "& a:hover": { textDecoration: "underline" },
    },
  ),
};
