# Phase 3: A link that stays current

[Phase 1](02-share-dialog.md) uploads a spec when the person clicks Share. This phase keeps the link current while the local viewer runs, so readers see each edit as it is saved, as the person running `diffmap serve` does. When the viewer stops, the link keeps showing the last version. It also adds versions, and **Stop sharing**.

**Today, after Phase 2**

A shared link shows the version uploaded when the person last clicked Share. Locally, `serve` watches the spec directory and tells the open page which file changed, over its reload socket ([[src/serve.ts#startServer]]).

**Proposed**

With **Keep this link updated** on, which is the default, `serve` uploads each saved change to the link within a second or two, and every open copy of the link updates in place: the page the reader is on reloads, and the page list updates when pages are added or renamed. Readers keep their scroll position and their comments.

The local viewer's header shows the link's state beside the Share button: "Shared · live", or "Shared · paused" when updates are off. When `serve` stops or the machine shuts down, the link stays up with the last version. The next time `serve` opens that spec, signed in as its owner, it resumes updating the same link.

`diffmap share --watch` does the same from the CLI without serving locally.

```services [An edit reaching a reader]
service Serve "diffmap serve, sharing"
service Worker
service Room "Durable Object for k3v9q2xa7m"
  state readers = 2 sockets
service Viewer "reader at diffmap.dev/s/k3v9q2xa7m"
  state version = 4

start "An edit appears on every open copy of the link"
  > serve uploads the changed files and a new manifest, the Worker tells the spec's Durable Object, and the object tells each open page which file changed.

step "The agent saves a page, and serve uploads a new version"
  Serve -> Worker: PUT the changed page's blob, POST version 5
step "The Worker tells the spec's room"
  Worker -> Room: version 5 changed 03-write-through.md
step "The room tells every open page"
  Room -> Viewer: {version: 5, page: "03-write-through.md"}
    > The same message the local reload socket sends, with the version added.
  Viewer.version = 5
```

`serve` uploads at most once every two seconds, combining edits made in between, which keeps it inside [the version limit](01-where-it-runs.md#limits) however fast the agent writes. The Durable Object uses WebSocket hibernation, so a spec nobody is editing costs nothing while readers sit on it, and pings every 30 seconds, as the local reload socket does, so proxies do not close a quiet connection.

## Versions

Each upload is a version, and shares its unchanged files with the version before it. The shared viewer's header says "Updated 5 minutes ago", with a menu of earlier versions. `/s/<id>@3` always opens version 3 and never updates live, so a link pasted into a review keeps showing what the reviewer saw. A reader's comments and Reviewed checkboxes are saved per page, not per version, so they carry over; a Reviewed checkbox still clears when that file's diff changes ([[src/viewer/reviewed.ts#useReviewedFiles]]).

Each spec keeps its last 50 versions. A daily scheduled job deletes older manifests, then any file no kept manifest names.

## Stop sharing

The dialog's access menu ends with **Stop sharing**, and the CLI has `diffmap share --stop <dir or link>`. The Worker marks the spec deleted at once, so the link answers "The owner stopped sharing this spec." It then deletes the spec's files from R2 and purges its URLs from Cloudflare's cache. An admin taking a spec down after a report does the same. `diffmap list --shared` lists the person's shared specs with their links, access, and sizes.

```changes

```
