import type { CSSProperties } from "react";
import { backgroundColor, borderColor, colors, shadowVars } from "maui";
import { style, useStyles } from "purse-styles";

/** A blurred shape, centered horizontally and relative to its mesh's edge (px). */
export type Blob = {
  x: number;
  y: number;
  w: number;
  h: number;
  rotate: number;
  color: string;
};

/** Film grain: gray fractal noise, tiled over the gradient. */
const GRAIN = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>",
)}")`;

type Strength = 5 | 6 | 7 | 8 | 9 | 10;
type ArmPoint = Omit<Blob, "color"> & { strength: Strength };

/**
 * Each mesh is one red arm and its green mirror image, turned 180° about the
 * mesh's center. One hue per side, stepping only in strength, keeps the
 * pattern about shape rather than color.
 */
function mirrored(points: ArmPoint[]): Blob[] {
  return points.flatMap(({ strength, ...point }) => [
    { ...point, color: colors.redAlpha[strength] },
    {
      ...point,
      x: -point.x,
      y: -point.y,
      color: colors.greenAlpha[strength],
    },
  ]);
}

// Matched to the header, so the page ends no louder than it starts.
const fade: Strength[] = [6, 6, 5, 5, 5, 5];

/**
 * The footer: a pinwheel. The red arm leaves the center heading left and
 * curls up as it grows; each ellipse points along its spoke and gets smaller
 * and fainter toward the tip.
 */
export const ribbonFooterBlobs = mirrored(
  fade.map((strength, index) => {
    const t = index / (fade.length - 1);
    const angle = Math.PI * (0.96 + 0.36 * t);
    const reach = 160 + 680 * t;
    const w = 640 - 220 * t;
    return {
      x: Math.round(reach * Math.cos(angle)),
      y: Math.round(reach * Math.sin(angle) * 0.6),
      w,
      h: Math.round(w * 0.7),
      rotate: Math.round(((angle - Math.PI) * 180) / Math.PI),
      strength,
    };
  }),
);

/**
 * The header: a faint S-shaped ribbon under the headline, so the headline's
 * own red and green words stay clear. The red half arches up on the left,
 * the green half dips down on the right, each ellipse tilted along the curve.
 */
const RIBBON_RISE = 70;
const RIBBON_SPAN = 900;
export const ribbonHeaderBlobs = mirrored(
  ([7, 7, 6, 6, 6] as Strength[]).map((strength, index, all) => {
    const t = index / (all.length - 1);
    const slope =
      (-RIBBON_RISE * Math.PI * Math.cos(t * Math.PI)) / RIBBON_SPAN;
    return {
      x: -Math.round(150 + (RIBBON_SPAN - 150) * t),
      y: Math.round(-RIBBON_RISE * Math.sin(t * Math.PI)),
      w: 560,
      h: 280,
      // The arm runs leftward, so the slope's sign flips on screen.
      rotate: Math.round((-Math.atan(slope) * 180) / Math.PI),
      strength,
    };
  }),
  // Offset slightly inward from the header's top edge.
).map((blob) => ({ ...blob, y: blob.y + 50 }));

/** Lagoon: a green pool between coral shores, flowing down from the header. */
export const headerBlobs = meshField([
  [-520, -100, 760, 560, 20, colors.redAlpha[8]],
  [520, 160, 700, 500, -30, colors.redAlpha[7]],
  [-70, 150, 760, 620, -25, colors.greenAlpha[8]],
  [270, -120, 540, 500, 35, colors.greenAlpha[7]],
  [-180, -180, 460, 350, -15, backgroundColor.app],
  [700, -100, 400, 440, 0, backgroundColor.app],
]);

/** The same Lagoon formation rising from the footer's bottom edge. */
export const footerBlobs = meshField([
  [-530, -180, 740, 500, 28, colors.redAlpha[8]],
  [600, 210, 720, 430, -25, colors.redAlpha[8]],
  [-80, 140, 740, 560, -20, colors.greenAlpha[8]],
  [250, -190, 530, 450, 30, colors.greenAlpha[7]],
  [-170, -170, 400, 320, -10, backgroundColor.app],
  [700, -120, 410, 420, 0, backgroundColor.app],
]);

export function meshField(
  points: [number, number, number, number, number, string][],
): Blob[] {
  return points.map(([x, y, w, h, rotate, color]) => ({
    x,
    y,
    w,
    h,
    rotate,
    color,
  }));
}

/** How far each blob fades out past its edge (px), like a 64px blur. */
const FEATHER = 128;

/**
 * A blob as a gradient that is solid in its core and fades out over
 * FEATHER on each side. Painting the softness instead of using
 * `filter: blur()` avoids Safari clipping the blurred layer to a hard edge.
 */
function softEllipse(shape: Blob): string {
  const size = Math.min(shape.w, shape.h) + 2 * FEATHER;
  const core = Math.max(0, (size - 4 * FEATHER) / size) * 100;
  const mid = core + (100 - core) / 2;
  const half = `color-mix(in oklab, ${shape.color} 50%, transparent)`;
  return `radial-gradient(closest-side, ${shape.color} ${core}%, ${half} ${mid}%, transparent)`;
}

/**
 * A grainy mesh gradient filling its positioned parent. `mask` fades its
 * edges into the page, such as a footer's top or a header's bottom.
 */
export function Mesh(props: {
  blobs: Blob[];
  mask: string;
  edge: "top" | "bottom";
  lamp?: boolean;
}) {
  const layer = useStyles(styles.layer);
  const blob = useStyles(styles.blob);
  const lamp = useStyles(styles.lamp);
  const grain = useStyles(styles.grain);
  const masked: CSSProperties = { maskImage: props.mask };
  const origin = props.edge === "top" ? "0%" : "100%";
  return (
    <>
      <div className={layer} style={masked} aria-hidden>
        {props.blobs.map((shape, index) => (
          <div
            key={index}
            className={blob}
            style={{
              left: `calc(50% + ${shape.x}px)`,
              top: `calc(${origin} + ${shape.y}px)`,
              width: shape.w + 2 * FEATHER,
              height: shape.h + 2 * FEATHER,
              rotate: `${shape.rotate}deg`,
              background: softEllipse(shape),
            }}
          />
        ))}
        {props.lamp && <div className={lamp} style={{ top: origin }} />}
      </div>
      <div className={grain} style={masked} aria-hidden />
    </>
  );
}

/** A solid element surface for the header and footer prompt cards. */
export const promptCode = style({
  "& > figure": {
    width: "fit-content",
    maxWidth: "100%",
    textAlign: "left",
    borderRadius: "12px",
    backgroundColor: backgroundColor.element,
    border: `1px solid ${borderColor.border}`,
    boxShadow: shadowVars.subtle,
  },
});

const styles = {
  layer: style({
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    '&:is(:root[data-theme="dark"] *)': { opacity: 0.45 },
  }),
  // Centered on its point; its feathered edge melts into its neighbors.
  blob: style({ position: "absolute", translate: "-50% -50%" }),
  // A pale spot at the color origin, so red and green do not mix into brown.
  lamp: style({
    position: "absolute",
    left: "50%",
    width: "570px",
    height: "290px",
    translate: "-50% -50%",
    background:
      "radial-gradient(closest-side, rgb(255 255 255 / 0.3), transparent)",
    '&:is(:root[data-theme="dark"] *)': { opacity: 0.15 },
  }),
  grain: style({
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    backgroundImage: GRAIN,
    opacity: 0.7,
    mixBlendMode: "overlay",
    '&:is(:root[data-theme="dark"] *)': { opacity: 0.35 },
  }),
};
