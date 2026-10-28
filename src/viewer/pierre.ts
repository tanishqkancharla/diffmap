import { border, colors, radius, shadow, spacing, text } from "maui";
import { style } from "purse-styles";
import { codeFontFamily } from "../codeFont.js";
import { diffsTheme } from "./diffsTheme.ts";

const pierreUnsafeCss = `:host { --diffs-font-family: ${codeFontFamily}; }`;

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

export const pierreShell = style(radius.md, shadow.subtle, {
  overflow: "hidden",
  minWidth: 0,
});

/** The `[Title]` row atop a code block or call stack, like Pierre's file header. */
export const fenceTitle = style(
  text({ size: "xs", fontWeight: 500, color: "lowContrast" }),
  spacing.padding({ x: 6, y: 4 }),
  border(["bottom"], "border"),
  { margin: 0, overflowWrap: "anywhere" },
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

export function pierreFileOptions(themeType: "light" | "dark") {
  return {
    theme: diffsTheme,
    themeType,
    overflow: "wrap" as const,
    unsafeCSS: pierreUnsafeCss,
  };
}
