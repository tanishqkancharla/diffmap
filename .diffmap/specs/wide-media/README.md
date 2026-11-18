# Wide previews and media

Previews, flows, screenshots, and diagrams were held to the prose column, about 640 px wide, so a flow's frame and a wide screenshot were scaled down until their text was hard to read. Text stays at the prose width because long lines are hard to read; pictures don't have that limit.

**Goals**

- Previews, flows, images, videos, galleries, HTML blocks, and Mermaid diagrams can grow to 1.5 times the prose width, centered on the text.
- Text, code, call stacks, and tables keep the prose width.
- An image is never shown larger than its own size.
- Wide blocks never cover the table of contents, never reach under the Diff panel, and never make the page scroll sideways.

**Non-goals**

- Full-width or "bleed" layouts chosen by the author.
- Making a block wider inside a `::details` section or a gallery cell.

[The wide column](01-wide-column.md) has the rules and before/after captures.
