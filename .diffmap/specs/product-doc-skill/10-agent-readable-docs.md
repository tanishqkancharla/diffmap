# Serve the website's documentation to agents

[The website phase](04-product-doc-website.md) delivers meaningful initial HTML. This phase adds a machine-readable route into the same content, rather than a second, independently maintained website.

## Today

The website entry point in [[gist/index.html]] contains an empty React root. The local CLI already serves page source for `Accept: text/markdown` with `Vary: Accept` in [[src/serve.ts]]; that does not establish equivalent behavior on the public website. A viewer route ending in `.md` is not proof of a Markdown response.

## Proposed

Generate website HTML and Markdown from the same content. Provide durable `.md` URLs and canonical-URL negotiation using **`Accept: text/markdown`**, not `Accepts`. Markdown responses use `Content-Type: text/markdown; charset=utf-8`; negotiated responses vary on Accept and the CDN cache must separate representations. Respect explicit HTML preference and quality values, including Markdown rejection.

Advertise Markdown with `rel="alternate" type="text/markdown"`, and the covering index with `rel="describedby"`. Add a short `/llms.txt` that links to the quickstart, explain/plan/review examples, install/update/remove instructions, privacy, and troubleshooting. Keep commands and prerequisites identical to the human pages. Do not publish an unavailable install target.

Illustrative routing contract, not implemented code:

```tsx
const page = resolvePublicPage(request.url);
const format = negotiateFormat(request); // .md path or Accept preference
return renderSameContent(page, format); // same access rules and facts
```

Missing pages remain real 404s, not successful responses containing the app shell. Keep private/shared document permissions identical across formats. Robots files are not access control. Add meaningful captions and text summaries for important diagrams and media so Markdown retains the reasoning without promising every interactive view survives conversion.

## Acceptance

Fetch HTML without JavaScript, negotiated Markdown, and explicit `.md` pages. Check body, content type, links, canonical identity, freshness, 404s, and both cache request orders. Test HTML preference, `text/markdown;q=0`, and mixed preferences. Ask an agent, starting only from `/llms.txt`, to find the supported install command and explain the first-document workflow; do not execute untrusted commands automatically.

## Why this scope, not every new manifest

The [llms.txt v2 proposal](https://llmstxt.org/) recommends Markdown twins and discovery link relations; it is a proposal, not guaranteed support from every assistant. [Vercel's own docs](https://vercel.com/docs/agent-resources/markdown-access) demonstrate negotiated Markdown, durable URLs, and cache separation; hosting on Vercel does not automatically give this app those features. [Cloudflare](https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/) offers optional origin-HTML conversion, not a reason to skip useful source HTML.

Defer `llms-full.txt`, custom knowledge graphs, and resource catalogs until size or actual consumers justify them. [WebMCP](https://webmachinelearning.github.io/webmcp/) exposes browser actions and is not a W3C Standard or Standards Track specification; it is not needed for this read-only launch site. MCP/OpenAPI become relevant if we offer a real remote tool/API, not merely to make documentation readable.

Crawl/search basics remain part of the website phase. [Google](https://developers.google.com/search/docs/appearance/ai-features) requires no special AI files for AI Search eligibility. [OpenAI](https://developers.openai.com/api/docs/bots) separates search crawling, training crawling, and user-triggered fetches; decide those policies independently, rather than calling one robots switch an all-agent policy.

```changes

```
