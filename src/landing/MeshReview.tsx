import { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  backgroundColor,
  Button,
  colors,
  flex,
  MauiProvider,
  useTheme,
} from "maui";
import { style, useStyles } from "purse-styles";
import { Landing } from "./Landing.tsx";
import {
  footerBlobs,
  headerBlobs,
  meshField,
  ribbonFooterBlobs,
  ribbonHeaderBlobs,
} from "./Mesh.tsx";
import "../viewer/styles.css";

// Review-only entry point; the production homepage uses Lagoon.
const formations = [
  {
    name: "Ribbon",
    note: "Original formation: a horizontal ribbon and curling footer.",
    header: ribbonHeaderBlobs,
    footer: ribbonFooterBlobs,
  },
  {
    name: "Cloud",
    note: "MagicPattern-inspired: asymmetric coral and green clouds with a soft neutral opening.",
    header: meshField([
      [-590, -95, 740, 420, -18, colors.redAlpha[8]],
      [-200, -145, 510, 270, 25, colors.redAlpha[7]],
      [380, -80, 680, 380, -24, colors.greenAlpha[8]],
      [20, 160, 600, 340, 18, colors.greenAlpha[7]],
      [760, 180, 450, 300, -15, colors.redAlpha[7]],
      [30, -130, 380, 250, 20, backgroundColor.app],
    ]),
    footer: meshField([
      [-550, -120, 800, 570, -25, colors.redAlpha[8]],
      [-130, -210, 520, 350, 10, colors.redAlpha[6]],
      [430, -70, 720, 560, -18, colors.greenAlpha[8]],
      [-10, 240, 740, 400, 15, colors.greenAlpha[7]],
      [800, 250, 540, 390, -30, colors.redAlpha[7]],
      [30, -60, 430, 350, 15, backgroundColor.app],
    ]),
  },
  {
    name: "Lagoon",
    note: "A green pool between coral shores; concentrated color with pale outer edges.",
    header: headerBlobs,
    footer: footerBlobs,
  },
  {
    name: "Fold",
    note: "Overlapping sweeps of red and green, with a neutral crease through the middle.",
    header: meshField([
      [-700, 110, 650, 380, -28, colors.redAlpha[8]],
      [-310, -30, 560, 300, -30, colors.redAlpha[8]],
      [100, -170, 570, 290, -15, colors.redAlpha[7]],
      [-140, 200, 530, 300, -25, colors.greenAlpha[7]],
      [320, 90, 670, 350, -26, colors.greenAlpha[8]],
      [760, -90, 680, 340, -20, colors.greenAlpha[8]],
      [-110, 10, 370, 200, -28, backgroundColor.app],
    ]),
    footer: meshField([
      [-720, 180, 750, 530, -28, colors.redAlpha[8]],
      [-300, -30, 640, 400, -30, colors.redAlpha[8]],
      [100, -230, 630, 400, -18, colors.redAlpha[7]],
      [-140, 280, 630, 380, -25, colors.greenAlpha[7]],
      [330, 120, 720, 460, -28, colors.greenAlpha[8]],
      [780, -120, 780, 460, -20, colors.greenAlpha[8]],
      [-110, 20, 400, 280, -30, backgroundColor.app],
    ]),
  },
];

function MeshReview() {
  const params = new URLSearchParams(window.location.search);
  const [selected, setSelected] = useState(() =>
    Math.max(
      0,
      formations.findIndex(
        (f) => f.name.toLowerCase() === (params.get("formation") ?? "lagoon"),
      ),
    ),
  );
  const { resolvedTheme, setPreference } = useTheme();
  const toolbar = useStyles(styles.toolbar);
  const controls = useStyles(styles.controls);
  const note = useStyles(styles.note);
  const formation = formations[selected]!;

  function select(index: number) {
    setSelected(index);
    const url = new URL(window.location.href);
    url.searchParams.set("formation", formations[index]!.name.toLowerCase());
    window.history.replaceState({}, "", url);
  }

  return (
    <>
      <aside className={toolbar} aria-label="Mesh comparison controls">
        <div className={controls}>
          {formations.map((f, index) => (
            <Button
              key={f.name}
              aria-pressed={index === selected}
              variant={index === selected ? "primary" : "quiet"}
              onPress={() => select(index)}
            >
              {f.name}
            </Button>
          ))}
          <Button
            aria-pressed={resolvedTheme === "light"}
            onPress={() => setPreference("light")}
          >
            Light
          </Button>
          <Button
            aria-pressed={resolvedTheme === "dark"}
            onPress={() => setPreference("dark")}
          >
            Dark
          </Button>
          <Button variant="quiet" onPress={() => window.scrollTo({ top: 0 })}>
            Header
          </Button>
          <Button
            variant="quiet"
            onPress={() =>
              document.querySelector("footer")?.scrollIntoView({ block: "end" })
            }
          >
            Footer
          </Button>
        </div>
        <p className={note}>
          {formation.note} Header flows from the top; footer rises from the
          bottom. Dark mode keeps the mesh, grain, and glow dimmed.
        </p>
      </aside>
      <Landing mesh={formation} />
    </>
  );
}

const styles = {
  toolbar: style({
    position: "sticky",
    top: 0,
    zIndex: 100,
    padding: "12px 20px",
    backgroundColor: backgroundColor.app,
    borderBottom: `1px solid ${colors.grayAlpha[5]}`,
  }),
  controls: style(flex({ direction: "row", alignItems: "center", gap: 4 }), {
    flexWrap: "wrap",
  }),
  note: style({ fontSize: "12px", color: colors.gray[11], marginTop: "8px" }),
};

createRoot(document.getElementById("root")!).render(
  <MauiProvider>
    <MeshReview />
  </MauiProvider>,
);
