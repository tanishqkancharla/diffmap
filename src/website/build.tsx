import fs from "node:fs/promises";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { init } from "md4x/napi";
import { createInMemoryStyleApi, style } from "purse-styles";
import { baseTextStyle } from "maui/src/tokens/text.ts";
import { shadowVars } from "maui/src/tokens/shadow.ts";
import { themeFoucScript } from "maui/src/theme/themeFoucScript.ts";
import { Logo } from "../landing/Logo.tsx";
import {
  examplePrompt,
  markdownPath,
  origin,
  pages,
  releaseStatus,
  repository,
} from "./content.ts";
import { renderPage } from "./render.tsx";

await init();
const out = path.resolve(process.argv[2] ?? "dist");
const initialStyle = style({
  ...baseTextStyle,
  color: "var(--ink)",
  "& body": { ...baseTextStyle, color: "var(--ink)" },
  "& .prompt-fallback": {
    boxShadow: shadowVars.subtle,
  },
});
const initialStyles = createInMemoryStyleApi();
initialStyles.addStyleElement(initialStyle);
const template = (await fs.readFile(path.join(out, "website.html"), "utf8"))
  .replace(
    '<html lang="en">',
    `<html lang="en" class="${initialStyle.className}">`,
  )
  .replace(
    "<!--page-meta-->",
    `${renderToStaticMarkup(
      <>
        <script dangerouslySetInnerHTML={{ __html: themeFoucScript }} />
        <style>{initialStyles.styleRulesRef.current.join("")}</style>
      </>,
    )}<!--page-meta-->`,
  );
initialStyles.detachVariableGroups();
await fs.rename(path.join(out, "index.html"), path.join(out, "viewer.html"));
await fs.mkdir(path.join(out, "pages"), { recursive: true });
for (const page of pages) {
  const name =
    page.path === "/" ? "index" : page.path.slice(1).replaceAll("/", "--");
  const html = renderPage(page, template);
  await fs.writeFile(path.join(out, "pages", `${name}.html`), html);
  await fs.writeFile(
    path.join(out, "pages", `${name}.md`),
    `${page.body.trim()}\n${page.path === "/" ? `\n## Get started\n\n${examplePrompt}\n\n[Install the skill and CLI](${origin}/docs/install)\n` : ""}`,
  );
  if (page.path === "/") await fs.writeFile(path.join(out, "index.html"), html);
}
await fs.writeFile(
  path.join(out, "llms.txt"),
  `# Productdoc

Visual documents for explaining systems, planning small changes, and reviewing changes.

${releaseStatus}

## Get started

${examplePrompt}

Install: npx skills add tanishqkancharla/diffmap --skill generate-product-doc
Public skill source: ${repository}/tree/main/skills/generate-product-doc
CLI guide: npx product-doc guide
Running the CLI does not install the skill. Load generate-product-doc in your agent after installation.

## Documentation

${pages
  .filter((p) => p.path !== "/")
  .map(
    (p) => `- [${p.title}](${origin}${markdownPath(p.path)}): ${p.description}`,
  )
  .join("\n")}
`,
);
await fs.writeFile(
  path.join(out, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.map((p) => `<url><loc>${origin}${p.path}</loc></url>`).join("")}</urlset>`,
);
// Search discovery is permitted; training permission is a separate conservative policy.
await fs.writeFile(
  path.join(out, "robots.txt"),
  `User-agent: *\nAllow: /\nDisallow: /g/\nDisallow: /pages/\n\nUser-agent: GPTBot\nDisallow: /\n\nUser-agent: ClaudeBot\nDisallow: /\n\nUser-agent: Google-Extended\nDisallow: /\n\nSitemap: ${origin}/sitemap.xml\n`,
);
const logo = renderToStaticMarkup(<Logo size={96} />).replace(
  "<svg ",
  '<svg xmlns="http://www.w3.org/2000/svg" ',
);
await fs.writeFile(path.join(out, "productdoc-logo.svg"), logo);
await fs.writeFile(
  path.join(out, "productdoc-social.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs><radialGradient id="green"><stop stop-color="#a2d8b7"/><stop offset="1" stop-color="#fcfcfc" stop-opacity="0"/></radialGradient><radialGradient id="red"><stop stop-color="#f7a99c"/><stop offset="1" stop-color="#fcfcfc" stop-opacity="0"/></radialGradient></defs><rect width="1200" height="630" fill="#fcfcfc"/><ellipse cx="600" cy="260" rx="700" ry="500" fill="url(#green)"/><ellipse cx="0" cy="100" rx="520" ry="480" fill="url(#red)"/><ellipse cx="1200" cy="250" rx="520" ry="480" fill="url(#red)"/><g transform="translate(72 54)">${logo}</g><g font-family="system-ui,sans-serif"><text x="185" y="116" font-size="46" font-weight="600" fill="#202020">productdoc</text><text x="72" y="300" font-size="76" font-weight="650" fill="#202020">Build software at</text><text x="72" y="398" font-size="76" font-weight="650" fill="#202020">the product level.</text><text x="72" y="540" font-size="28" fill="#646464">Explain · Plan · Review</text></g></svg>`,
);
await fs.writeFile(
  path.join(out, "404.html"),
  renderPage(
    {
      path: "/404",
      title: "Page not found",
      label: "404",
      description: "This page does not exist.",
      body: "# Page not found\n\nThis link does not resolve to a public documentation page.\n\n[Return to Productdoc](/)",
    },
    template,
  ),
);
await fs.rm(path.join(out, "website.html"));
console.log(
  `Generated ${pages.length} Productdoc pages from one content source.`,
);
