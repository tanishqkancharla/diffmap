# Animated service diagrams

A `services` fence declares services, their state, and their sub-services, then replays the events they send each other one step at a time. Press **Play**, or step with the arrow buttons or ← and →. Click a segment in the progress bar to jump to a step.

A step's events travel one after another, in the order written. The step's state updates land when the last one arrives, and the changed values stay highlighted until the next step. A step can put notes beside its events, its changed state, and its services to explain them. Service names and state keys with a dotted underline have a description; hover or focus them to read it.

```text
%% A service with an optional label and reference
service API "HTTP server" [[src/serve.ts]]
  %% A description, shown in a tooltip, directly below what it describes
  > Accepts HTTP requests and routes them to its services.
  %% State, indented under its service
  state requests = 0
  %% A sub-service, indented further
  service Auth

%% A caption for the whole diagram, shown above it before the first step
start "API checks every request with Auth"
  %% Optional: an overview of the whole process, shown under the caption
  > A request reaches API, which asks Auth to verify it before any handler runs.

%% A step, with a caption that says what happens
step "API asks Auth to verify"
  %% Optional: a longer explanation, shown under the caption
  > Every request passes through Auth before it reaches a handler.
  %% An event with an optional label and reference
  API -> Auth: verify(alice) [[src/serve.ts]]
    %% Optional: a note shown beside the event during this step
    > Sends the username and the password from the form.
  %% A state update
  API.requests = 1
    %% Optional: a note shown beside the changed state during this step
    > Counted before Auth answers, so failed logins count too.
  %% Optional: a service name alone, with a note shown beside it during this step
  Auth
    > Holds the request until Auth answers.
```

## Logging in

Alice's login crosses two services inside the API and two trips to Postgres. Auth checks the hash itself, so that step loops back into Auth.

```services
service Browser "login page"
  > The login form running in Alice's browser tab.
  state form = empty
    > What the form shows: empty, submitting, or signed in.
  state cookie = none
    > The session cookie the browser sends with later requests.
service API "HTTP server"
  > The Node server that receives every request.
  service Auth
    > Checks passwords and rate-limits failed attempts.
    state failedAttempts = 0
      > Failures since the last success. Five locks the account.
  service Sessions
    > Creates and looks up login sessions.
    state active = 0
      > Sessions held in the in-memory cache.
service Postgres
  > The primary database.
  state users = alice, bob
  state sessions = 0 rows
    > Rows in the sessions table.

start "Alice logs in"
  > Auth checks her password against the hash in Postgres, Sessions stores a new session, and the API returns it to the browser as a cookie.

step "Alice submits the login form"
  Browser -> API: POST /login
    > Over HTTPS, with the password in the request body.
  Browser.form = submitting
    > The button shows a spinner until the response arrives.
step "The API hands the credentials to Auth"
  API -> Auth: verify(alice, ••••)
step "Auth loads Alice's password hash"
  Auth -> Postgres: SELECT hash
step "Postgres returns the stored hash"
  Postgres -> Auth: $2b$12$Qe…
    > A bcrypt hash: the cost factor (12), the salt, and the hash itself.
step "Auth compares the hash"
  > bcrypt hashes the submitted password with the stored salt and compares the results in constant time.
  Auth -> Auth: bcrypt.compare
  Auth
    > The check runs inside Auth, so the password never reaches Postgres.
step "The password matches, so Auth asks Sessions for a session"
  Auth -> Sessions: create(alice)
step "Sessions stores the new session"
  Sessions -> Postgres: INSERT s_81f
    > Writes the session ID, user, and a 30-day expiry.
  Postgres.sessions = 1 row
  Sessions.active = 1
    > Cached so later requests skip the database lookup.
step "Sessions hands the session ID back to the API"
  Sessions -> API: s_81f
step "The API sets the session cookie"
  API -> Browser: 200 Set-Cookie
    > The cookie is HttpOnly and SameSite=Lax, so page scripts can't read it.
  Browser.cookie = sid=s_81f
  Browser.form = signed in
```

## Optimistic like with live updates

Alice's tab updates before the server answers. The backend then confirms to Alice and fans the new count out to every open tab at once.

```services
service AliceTab "Alice's browser"
  state liked = false
  state likes = 41
service Backend
  service API
    state likes = 41
  service Hub "realtime fan-out"
    > Pushes changes to every tab that has the post open, over WebSockets.
    state subscribers = 2
      > Open tabs subscribed to this post.
service BobTab "Bob's browser"
  state likes = 41

start "A like reaches every open tab"
  > Alice's tab shows her like right away. The API saves it, confirms to Alice, and the Hub pushes the new count to Bob's tab.

step "Alice clicks Like, and her tab updates right away"
  AliceTab.liked = true
  AliceTab.likes = 42 (pending)
    > Shown before the server confirms it. Rolls back to 41 if the request fails.
step "The tab sends the like"
  AliceTab -> API: POST /like
  API.likes = 42
step "The API confirms and publishes the change"
  API -> AliceTab: 200 likes=42
  API -> Hub: post.liked
    > Published after the write commits, so subscribers never see a count that rolls back.
  AliceTab.likes = 42
    > Confirmed, so the pending marker goes away.
step "The hub pushes the new count to every subscriber"
  Hub -> AliceTab: likes=42
  Hub -> BobTab: likes=42
  BobTab.likes = 42
    > Bob sees the like without reloading.
```

## Opening a reference in diffmap

This one describes diffmap itself. Click a service name or an event label marked ↗ to open its source.

```services
service Reader
service Viewer "browser tab"
  service ViewerApp [[src/viewer/ViewerApp.tsx#ViewerApp]]
    state selection = none
    state showDiffPanel = false
  service SourceDiffPanel [[src/viewer/SourceDiffPanel.tsx#SourceDiffPanel]]
    state resolution = none
service Server "diffmap serve" [[src/serve.ts#startServer]]
  service Definitions [[src/definitions.ts]]

step "The reader clicks a linked call stack row"
  Reader -> ViewerApp: click row [[src/viewer/CallStackDiff.tsx#CallStackDiff]]
  ViewerApp.selection = Store.save
  ViewerApp.showDiffPanel = true
step "ViewerApp opens the panel on that reference"
  ViewerApp -> SourceDiffPanel: selection
step "The panel asks the server for the source"
  SourceDiffPanel -> Server: GET /__diffmap/source [[src/viewer/sourceNavigation.ts#useSourceReference]]
step "The server reads the file and finds the declaration"
  Server -> Definitions: readSourceReference [[src/serve.ts#handleDiffmapRequest]]
step "Definitions returns the declaration's lines"
  Definitions -> Server: lines 12–30 [[src/definitions.ts#readSourceReference]]
    > TypeScript finds the symbol's declaration; the server sends its line range with the file.
step "The panel shows the declaration"
  Server -> SourceDiffPanel: { definition }
  SourceDiffPanel.resolution = store.ts L12–30
```
