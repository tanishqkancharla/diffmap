# Phase 4: Live links

[Phase 3](04-one-link-per-document.md) gave each document one link, updated when the person shares again. This phase updates it on its own while the local viewer is open, so readers see each edit as it is saved, as the person running `product-doc serve` does. When the viewer closes, the link keeps the last version.

**Today, after Phase 3**

A shared link shows the version uploaded when the person last clicked Share. Locally, `serve` watches the document directory and tells the open page which file changed, over its reload socket ([[src/serve.ts#startServer]]).

**Proposed**

The dialog gains one option, on by default: **Update the link as you edit**. Under it, the dialog says what that means: while this viewer is open, readers see each edit you save, and when it closes, the link keeps the last version.

```preview [The live option in the dialog]
share-dialog--live-option
```

While the link is live, the header button reads **Shared · Live**, with a green dot:

```preview [The header button for a live link]
share-header-button--shared
share-header-button--live
```

`serve` uploads each saved change within a second or two, and every open copy of the link updates in place: the page the reader is on reloads, and the page list updates when pages are added or renamed. Readers keep their scroll position and their comments. When `serve` stops or the machine shuts down, the link stays up with the last version, and the button goes back to **Shared** the next time `serve` opens the document, until it resumes updating. `product-doc share --watch` does the same from the CLI without serving locally.

```services [An edit reaching a reader]
service Serve "product-doc serve, sharing"
service Worker
service Room "Durable Object for k3v9q2xa7m"
  state readers = 2 sockets
service Viewer "reader at productdoc.dev/d/k3v9q2xa7m"
  state version = 4

start "An edit appears on every open copy of the link"
  > serve uploads the changed files and a new manifest, the Worker tells the document's Durable Object, and the object tells each open page which file changed.

step "The agent saves a page, and serve uploads a new version"
  Serve -> Worker: PUT the changed page's blob, POST version 5
step "The Worker tells the document's room"
  Worker -> Room: version 5 changed 03-write-through.md
step "The room tells every open page"
  Room -> Viewer: {version: 5, page: "03-write-through.md"}
    > The same message the local reload socket sends, with the version added.
  Viewer.version = 5
```

`serve` uploads at most once every two seconds, combining edits made in between, which keeps it inside [the version limit](01-where-it-runs.md#limits) however fast the agent writes. The Durable Object uses WebSocket hibernation, so a document nobody is editing costs nothing while readers sit on it, and pings every 30 seconds, as the local reload socket does, so proxies do not close a quiet connection.

## Todos

- [ ] The live option in the dialog, saved per document
- [ ] `serve` uploads changed files on save, at most once every two seconds
- [ ] A Durable Object per document that holds readers' sockets and sends each new version
- [ ] The shared viewer reloads the changed page, and the page list, without losing scroll or comments
- [ ] The header button's Shared · Live state
- [ ] `product-doc share --watch`
- [ ] Tests for a burst of edits, and for a viewer reconnecting after `serve` restarts

```changes

```
