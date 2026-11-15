# Phase 3: Live updates

[Phase 2](03-update-and-delete.md) made sharing again update the same link. This phase keeps the link current while the agent works, so someone reading the shared spec sees each edit, as the person running `diffmap serve` does.

**Today**

`serve` watches the spec directory and sends the open page a message over its reload socket when a page changes ([[src/serve.ts#startServer]]). The message is the changed page's file name, or `pages` when the list of pages changed, and the viewer reloads just that. A shared gist never changes.

**Proposed**

`diffmap share --watch` shares the spec, prints the link, and stays running. Each time a page, a media file, or a changes card's commit changes, it uploads a new version within a second or two, and every open copy of the link updates in place: the page the reader is on reloads, and the page list updates when pages are added or renamed. The reader keeps their scroll position and comments, as with `serve`.

`serve --share` does the same while also serving locally, so the person sees their own changes at once and everyone else a moment later.

```services [An edit reaching a reader]
service Agent "agent editing the spec"
service CLI "diffmap share --watch"
service Worker
service Room "Durable Object for k3v9q2xa7m"
  state readers = 2 sockets
service Viewer "reader at diffmap.dev/s/k3v9q2xa7m"
  state version = 4

start "An edit appears on every open copy of the link"
  > The CLI uploads the changed files and a new manifest, the Worker tells the spec's Durable Object, and the object tells each open page which file changed.

step "The agent saves a page"
  Agent -> CLI: 03-write-through.md changed
step "The CLI uploads a new version"
  CLI -> Worker: PUT the changed page's blob, POST version 5
step "The Worker tells the spec's room"
  Worker -> Room: version 5 changed 03-write-through.md
step "The room tells every open page"
  Room -> Viewer: {version: 5, page: "03-write-through.md"}
    > The same message the local reload socket sends, with the version added.
  Viewer.version = 5
```

The viewer opens its socket at `wss://diffmap.dev/api/specs/<id>/live` only when it shows the latest version; a pinned link such as `/s/<id>@3` never changes. The Durable Object uses WebSocket hibernation, so a spec nobody is editing costs nothing while readers sit on it. It sends a ping every 30 seconds, as the local reload socket does, so proxies do not close a quiet connection.

`--watch` uploads at most once every two seconds, combining edits made in between, which keeps it inside [the version limit](01-where-it-runs.md#limits) however fast the agent writes. The versions it makes count toward the 50 a spec keeps, so a long session replaces the oldest ones.

```changes

```
