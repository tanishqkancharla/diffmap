import { useTheme } from "maui";
import { useMemo } from "react";

/** Trusted HTML in the viewer's current theme. */
export function useThemedHtml(source: string) {
  const { resolvedTheme } = useTheme();
  return useMemo(
    () => (resolvedTheme === "dark" ? darkHtml(source) : source),
    [source, resolvedTheme],
  );
}

/**
 * Trusted HTML usually hard-codes a light palette. In the dark theme,
 * darkHtml rewrites its CSS colors to the same hue and chroma at mirrored
 * OKLab lightness, so dark text turns light and light cards turn dark.
 * Backgrounds that are already dark and text that is already light keep their
 * color, so light text on a dark or accent fill stays readable.
 * HTML that already themes itself is left alone.
 */
export function darkHtml(source: string) {
  if (/light-dark\(|prefers-color-scheme|data-theme/.test(source))
    return source;
  return source
    .replace(
      /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi,
      (_, open: string, css: string, close: string) =>
        open + darkDeclarations(css) + close,
    )
    .replace(
      /(\sstyle\s*=\s*)("[^"]*"|'[^']*')/gi,
      (_, name: string, value: string) => name + darkDeclarations(value),
    )
    .replace(
      /(\s(?:fill|stroke|color|bgcolor|stop-color)\s*=\s*)("[^"]*"|'[^']*')/gi,
      (_, name: string, value: string) =>
        name + darkColors(value, roleOf(name)),
    );
}

/** Which colors a property mirrors: light surfaces, dark text, or all paint. */
type Role = "surface" | "text" | "paint";

function roleOf(property: string): Role {
  const name = property.replace(/[\s:=]/g, "").toLowerCase();
  if (name.startsWith("background") || name === "bgcolor") return "surface";
  if (name === "color") return "text";
  return "paint";
}

/** Colors in declaration values only, so selectors such as `#fade` stay. */
function darkDeclarations(css: string) {
  return css.replace(
    /([\w-]+\s*:)([^;{}]+)(?=[;}"']|$)/g,
    (_, property: string, value: string) =>
      property + darkColors(value, roleOf(property)),
  );
}

function darkColors(value: string, role: Role) {
  return value.replace(
    /(?<!url\()#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\([^)]*\)|\b(?:white|black)\b/gi,
    (color) => {
      const rgba = parseColor(color.toLowerCase());
      return (rgba && darkColor(rgba, role)) ?? color;
    },
  );
}

type Rgba = [number, number, number, number];

function parseColor(color: string): Rgba | undefined {
  if (color === "white") return [1, 1, 1, 1];
  if (color === "black") return [0, 0, 0, 1];
  if (color.startsWith("#")) {
    let hex = color.slice(1);
    if (hex.length === 3 || hex.length === 4) hex = hex.replace(/./g, "$&$&");
    if (hex.length !== 6 && hex.length !== 8) return undefined;
    const byte = (index: number) =>
      parseInt(hex.slice(index, index + 2), 16) / 255;
    return [byte(0), byte(2), byte(4), hex.length === 8 ? byte(6) : 1];
  }
  const match = /^(rgba?|hsla?)\(([^)]*)\)$/.exec(color);
  if (!match) return undefined;
  const parts = match[2]!.split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3 || parts.length > 4) return undefined;
  const alpha = parts[3] === undefined ? 1 : number(parts[3], 1);
  const rgba: Rgba = match[1]!.startsWith("rgb")
    ? [
        number(parts[0]!, 255),
        number(parts[1]!, 255),
        number(parts[2]!, 255),
        alpha,
      ]
    : [
        ...hslToRgb(
          parseFloat(parts[0]!),
          number(parts[1]!, 100),
          number(parts[2]!, 100),
        ),
        alpha,
      ];
  return rgba.every(Number.isFinite) ? rgba : undefined;
}

function hslToRgb(hue: number, saturation: number, lightness: number) {
  const k = (n: number) => (n + hue / 30) % 12;
  const a = saturation * Math.min(lightness, 1 - lightness);
  const f = (n: number) =>
    lightness - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)] as const;
}

function darkColor([red, green, blue, alpha]: Rgba, role: Role) {
  const [r, g, b] = [linear(red), linear(green), linear(blue)];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  if (role === "surface" && lightness <= 0.5) return undefined;
  if (role === "text" && lightness >= 0.5) return undefined;
  // White lands on the dark card surface and near-black on the dark theme's text.
  const mirrored = Math.min(1, Math.max(0, 1.13 - 0.9125 * lightness));
  return `oklab(${round(mirrored)} ${round(a)} ${round(bb)} / ${round(alpha)})`;
}

/** A percentage, or a number out of `scale`, as a fraction. */
function number(part: string, scale: number) {
  return part.endsWith("%") ? parseFloat(part) / 100 : parseFloat(part) / scale;
}

function linear(c: number) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function round(n: number) {
  return Math.round(n * 1000) / 1000;
}
