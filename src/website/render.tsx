import { renderToStaticMarkup } from "react-dom/server";
import { renderToHtml } from "md4x/napi";
import { renderMermaidSVG } from "beautiful-mermaid";
import { Logo } from "../landing/Logo.tsx";
import { Mesh, headerBlobs, footerBlobs } from "../landing/Mesh.tsx";
import { examples, examplePages } from "./examples.ts";
import {
  examplePrompt,
  markdownPath,
  origin,
  pages,
  repository,
  type Page,
} from "./content.ts";

// The demo's glow rises above it into the hero, then fades out evenly around
// the top of the reader instead of stopping at a flat edge.
const DEMO_LIFT = 300;
const demoBlobs = headerBlobs.map((blob) => ({
  ...blob,
  y: blob.y + DEMO_LIFT,
}));

function Markdown({ source }: { source: string }) {
  return (
    <div
      dangerouslySetInnerHTML={{
        __html: renderToHtml(source, {
          headingIds: true,
          // oxlint-disable-next-line react/no-unstable-nested-components -- md4x calls this synchronous HTML serializer; it is not a mounted component.
          highlighter(code, block) {
            if (block.lang === "mermaid") {
              const svg = renderMermaidSVG(code, {
                transparent: true,
                fg: "var(--ink)",
                bg: "var(--paper)",
                surface: "var(--surface)",
                line: "var(--muted)",
                accent: "var(--green)",
                border: "var(--line)",
                font: "system-ui, sans-serif",
              });
              return `<figure class="diagram" role="img" aria-label="Workflow diagram for this section">${svg}</figure>`;
            }
            if (block.lang === "diff") {
              return renderToStaticMarkup(
                <pre className="prose-diff">
                  <code>
                    {code
                      .trimEnd()
                      .split("\n")
                      .map((line, i) => (
                        <span
                          key={i}
                          className={
                            line.startsWith("+")
                              ? "added"
                              : line.startsWith("-")
                                ? "removed"
                                : undefined
                          }
                        >
                          {line}
                          {"\n"}
                        </span>
                      ))}
                  </code>
                </pre>,
              );
            }
            return undefined;
          },
        }),
      }}
    />
  );
}

function Home({ page }: { page: Page }) {
  return (
    <>
      <header className="hero">
        <div className="hero-content">
          <div className="hero-intro">
            <Markdown source={page.body} />
          </div>
          <div className="prompt" id="prompt-snippet">
            <pre className="prompt-fallback">
              <code>{examplePrompt}</code>
            </pre>
          </div>
        </div>
      </header>
      <div className="demo-stage" id="examples">
        <div className="demo-glow" aria-hidden>
          {/* Sticks when the reader does and ends at the screen's bottom edge,
              so the glow stays put while the document scrolls, then leaves with it. */}
          <div
            id="demo-mesh"
            style={{
              top: -DEMO_LIFT,
              marginTop: -DEMO_LIFT,
              height: `calc(${DEMO_LIFT}px + 100svh)`,
            }}
          >
            <Mesh
              blobs={demoBlobs}
              edge="top"
              mask={`radial-gradient(ellipse 80% 420px at 50% ${DEMO_LIFT + 190}px, black 25%, 60%, transparent)`}
            />
          </div>
        </div>
        <p className="demo-caption">
          <em>Preview an example document</em>
          {" · "}
          <a href="/examples">Explore Explain, Plan, and Review →</a>
        </p>
        <div id="reader-demo">
          <div className="demo-placeholder">
            <div className="browser-bar">
              ○ ○ ○ <span>Interactive reader demo</span>
            </div>
            <div className="demo-fallback">
              <h2>Reasoning first. Code in context.</h2>
              <p>A document you can read, explore, and comment on.</p>
              <a href="/examples/explain">Read an example →</a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ExamplesWorkspace({ page }: { page: Page }) {
  const selected =
    page.path === "/examples"
      ? examplePages.find((item) => item.path === examples[0].path)!
      : page;
  const example = examples.find((item) => selected.path.startsWith(item.path))!;
  return (
    <>
      <aside className="examples-sidebar" aria-label="Example documents">
        <header>
          <h1>Examples</h1>
          <p>
            Explore a finished document.
            <br />
            See the reasoning, then the code.
          </p>
        </header>
        <nav aria-label="Choose an example">
          {examplePages
            .filter((item) => item.path !== "/examples")
            .map((item) => (
              <a
                className="example-item"
                key={item.path}
                href={item.path}
                aria-current={selected.path === item.path ? "page" : undefined}
              >
                <span className="eyebrow">{item.label.split(" · ")[0]}</span>
                <span className="example-title">{item.title}</span>
                <span className="example-description">{item.description}</span>
              </a>
            ))}
        </nav>
        <div className="examples-sidebar-footer">
          <p>A fictional app, rendered with the real Productdoc reader.</p>
          <a href="/docs/quickstart">Try it with your agent →</a>
        </div>
      </aside>
      <div className="example-main">
        <div className="example-toolbar">
          <span>{selected.label}</span>
          <a href={markdownPath(selected.path)}>Markdown ↗</a>
          <details className="example-prompt">
            <summary>Example prompt</summary>
            <div>
              <p>{example.prompt}</p>
              <a href="/docs/quickstart">Set up the skill →</a>
            </div>
          </details>
        </div>
        <section
          className="example-reader"
          data-example={selected.path}
          aria-label={`${example.kind} example document`}
        >
          <article className="prose example-fallback">
            <Markdown source={selected.body} />
          </article>
        </section>
      </div>
    </>
  );
}

function Site({ page }: { page: Page }) {
  const home = page.path === "/";
  const examplesPage = page.path.startsWith("/examples");
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <nav className="nav" aria-label="Main navigation">
        <a className="brand" href="/">
          <Logo size={28} />
          productdoc
        </a>
        <div className="nav-links">
          <a
            href="/examples"
            aria-current={
              page.path.startsWith("/examples") ? "page" : undefined
            }
          >
            Examples
          </a>
          <a href="/docs/quickstart">Docs</a>
          <a href={repository}>
            GitHub <span aria-hidden>↗</span>
          </a>
        </div>
      </nav>
      <main
        id="main"
        className={
          home
            ? "home"
            : examplesPage
              ? "examples-workspace"
              : "document-layout"
        }
      >
        {home ? (
          <Home page={page} />
        ) : examplesPage ? (
          <ExamplesWorkspace page={page} />
        ) : (
          <>
            <aside className="sidebar" aria-label="Documentation">
              <p className="eyebrow">Read the product</p>
              {pages
                .filter((p) => p.path !== "/")
                .map((p) => (
                  <a
                    key={p.path}
                    href={p.path}
                    aria-current={p.path === page.path ? "page" : undefined}
                  >
                    {p.path.startsWith("/examples/plan/") ? "↳ " : ""}
                    {p.label.startsWith("Explain")
                      ? "Explain"
                      : p.path === "/examples/plan"
                        ? "Plan"
                        : p.label.startsWith("Review")
                          ? "Review"
                          : p.title}
                  </a>
                ))}
            </aside>
            <article className="prose">
              <header>
                <p className="eyebrow">{page.label}</p>
                <div className="formats">
                  <a href={markdownPath(page.path)}>Read Markdown</a>
                  <a href="/llms.txt">Agent index</a>
                </div>
              </header>
              <Markdown source={page.body} />
              {page.path === "/privacy" && (
                <section data-analytics-controls hidden>
                  <h2>Website analytics preference</h2>
                  <p>
                    Optional anonymous page and setup-intent events, as
                    described above.
                  </p>
                  <button data-allow>Allow website analytics</button>{" "}
                  <button data-deny>Turn website analytics off</button>
                  <p role="status" />
                </section>
              )}
            </article>
          </>
        )}
      </main>
      {!examplesPage && (
        <footer className="footer">
          <div id="footer-mesh" aria-hidden>
            <Mesh
              blobs={footerBlobs}
              edge="bottom"
              mask="linear-gradient(to top, black, black 12%, transparent 90%)"
              lamp
            />
          </div>
          <a className="brand" href="/">
            <Logo size={28} />
            productdoc
          </a>
          <p>Build software at the product level.</p>
          <div>
            <a href="/privacy">Privacy</a>
            <a href="/docs/migration">From Diffmap</a>
            <a href={`${repository}/issues`}>Support</a>
            <a href="/llms.txt">For agents</a>
            <a href={markdownPath(page.path)}>Markdown</a>
          </div>
          <small>Open source · MIT</small>
        </footer>
      )}
    </>
  );
}

export function renderPage(page: Page, template: string) {
  const canonical = `${origin}${page.path}`;
  const meta = renderToStaticMarkup(
    <>
      <title>
        {page.path === "/"
          ? `Productdoc — ${page.title}`
          : `${page.title} · Productdoc`}
      </title>
      <meta name="description" content={page.description} />
      <link rel="canonical" href={canonical} />
      <link
        rel="alternate"
        type="text/markdown"
        href={`${origin}${markdownPath(page.path)}`}
      />
      <link rel="describedby" type="text/plain" href={`${origin}/llms.txt`} />
      <meta property="og:title" content={`${page.title} · Productdoc`} />
      <meta property="og:description" content={page.description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content={`${origin}/productdoc-social.png`} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta
        property="og:image:alt"
        content="Productdoc — Build software at the product level. Explain, plan, review."
      />
      <meta name="twitter:card" content="summary_large_image" />
    </>,
  );
  return template
    .replace("<!--page-meta-->", meta)
    .replace("<!--page-content-->", renderToStaticMarkup(<Site page={page} />));
}
