import { renderToStaticMarkup } from "react-dom/server";
import { renderToHtml } from "md4x/napi";
import { renderMermaidSVG } from "beautiful-mermaid";
import { Logo } from "../landing/Logo.tsx";
import {
  markdownPath,
  origin,
  pages,
  repository,
  type Page,
} from "./content.ts";

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
              return `<figure class="diagram" role="img" aria-label="A document directory is validated, then a requested page is resolved. Missing pages return not found; valid pages show their neighbors.">${svg}<figcaption>Validate the document before resolving the page. A missing page is not the cover.</figcaption></figure>`;
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
  const [intro = "", examples = "", feedback = "", migration = ""] =
    page.body.split(/^## /m);
  const [exampleIntro = "", ...cards] = examples.split(/^### /m);
  return (
    <>
      <header className="hero lagoon">
        <div id="hero-mesh" aria-hidden />
        <div className="hero-content">
          <div className="hero-intro">
            <Markdown source={intro} />
          </div>
          <div className="prompt">
            <p>Start with a question for your agent</p>
            <div className="prompt-code">
              <code>
                Explain how this system works. Show the decisions, not just the
                code.
              </code>
              <button data-copy-prompt aria-label="Copy example prompt">
                Copy
              </button>
            </div>
          </div>
          <p className="availability">
            Skill installation is not live yet.{" "}
            <a data-install-cta href="/docs/install">
              Release status ↗
            </a>
          </p>
        </div>
      </header>
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
      <section className="examples" id="examples">
        <Markdown source={`## ${exampleIntro}`} />
        <div className="cards">
          {cards.map((card) => (
            <article key={card} className="card">
              <Markdown source={`### ${card}`} />
            </article>
          ))}
        </div>
      </section>
      <section className="conversation">
        <Markdown source={`## ${feedback}`} />
      </section>
      <section className="migration">
        <Markdown source={`## ${migration}`} />
      </section>
    </>
  );
}

function Site({ page }: { page: Page }) {
  const home = page.path === "/";
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
          <a href="/#examples">Examples</a>
          <a href="/docs/quickstart">Docs</a>
          <a href={repository}>
            GitHub <span aria-hidden>↗</span>
          </a>
        </div>
      </nav>
      <main id="main" className={home ? "home" : "document-layout"}>
        {home ? (
          <Home page={page} />
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
      <footer className="footer">
        <div id="footer-mesh" aria-hidden />
        <a className="brand" href="/">
          <Logo size={28} />
          productdoc
        </a>
        <p>Make the reasoning something you can read.</p>
        <div>
          <a href="/privacy">Privacy</a>
          <a href="/docs/migration">From Diffmap</a>
          <a href={`${repository}/issues`}>Support</a>
          <a href="/llms.txt">For agents</a>
          <a href={markdownPath(page.path)}>Markdown</a>
        </div>
        <small>Open source · MIT · Local review preview</small>
      </footer>
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
