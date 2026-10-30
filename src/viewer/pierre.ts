import {
  backgroundColor,
  border,
  colors,
  radius,
  shadow,
  spacing,
  text,
} from "maui";
import { style } from "purse-styles";
import type { FileDiffMetadata } from "@pierre/diffs";
import { codeFontFamily } from "../codeFont.js";
import { diffsTheme } from "./diffsTheme.ts";

// Pierre paints its own white; widgets use the element surface instead.
const pierreUnsafeCss = `:host { --diffs-font-family: ${codeFontFamily}; --diffs-light-bg: ${backgroundColor.app}; --diffs-dark-bg: ${backgroundColor.app}; }`;

export const sourceSelectionCss = `
[data-selected-line] {
  --diffs-computed-selected-line-bg: var(--diffs-computed-diff-line-bg);
}
[data-line][data-selected-line] {
  box-shadow: inset 4px 0 ${colors.blue[9]};
}
[data-column-number][data-selected-line] {
  background-color: ${colors.blue[3]};
  color: ${colors.blue[12]};
}
`;

/** The card every widget sits in: a subtle ring on the page background. */
export const pierreShell = style(radius.md, shadow.subtle, {
  overflow: "hidden",
  minWidth: 0,
});

/** The header row atop a card: a fence's `[Title]` or a diagram's caption. */
export const fenceTitle = style(
  text({ size: "xs", fontWeight: 500, color: "lowContrast" }),
  spacing.padding({ x: 6, y: 4 }),
  border(["bottom"], "border"),
  { margin: 0, overflowWrap: "anywhere", backgroundColor: colors.gray[2] },
);

export function pierreDiffOptions(input: {
  themeType: "light" | "dark";
  disableFileHeader: boolean;
}) {
  return {
    theme: diffsTheme,
    themeType: input.themeType,
    overflow: "wrap" as const,
    diffStyle: "unified" as const,
    unsafeCSS: pierreUnsafeCss,
    disableFileHeader: input.disableFileHeader,
  };
}

/** The text of one line on a diff side, or undefined when the patch leaves it out. */
export function diffLineText(
  diff: FileDiffMetadata,
  side: "additions" | "deletions",
  lineNumber: number,
) {
  const key = side === "deletions" ? "deletion" : "addition";
  const hunk = diff.hunks.find(
    (h) =>
      lineNumber >= h[`${key}Start`] &&
      lineNumber < h[`${key}Start`] + h[`${key}Count`],
  );
  if (diff.isPartial && hunk === undefined) return undefined;
  const index =
    diff.isPartial && hunk !== undefined
      ? hunk[`${key}LineIndex`] + lineNumber - hunk[`${key}Start`]
      : lineNumber - 1;
  return diff[`${key}Lines`][index]?.replace(/\r?\n$/, "");
}

export function pierreFileOptions(themeType: "light" | "dark") {
  return {
    theme: diffsTheme,
    themeType,
    overflow: "wrap" as const,
    unsafeCSS: pierreUnsafeCss,
  };
}
