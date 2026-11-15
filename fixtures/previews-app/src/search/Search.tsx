import { useEffect, useState } from "react";
import { Button } from "../ui";

type Doc = { id: string; title: string; meta: string };
type State =
  | { name: "idle" }
  | { name: "loading" }
  | { name: "results"; docs: Doc[] }
  | { name: "error" };

export function Search() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<State>({ name: "idle" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (query.trim() === "") {
      setState({ name: "idle" });
      return;
    }
    let current = true;
    const timer = setTimeout(async () => {
      setState({ name: "loading" });
      const response = await fetch(
        `/api/search?${new URLSearchParams({ q: query })}`,
      );
      if (!current) return;
      if (!response.ok) setState({ name: "error" });
      else
        setState({ name: "results", docs: (await response.json()) as Doc[] });
    }, 250);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query, attempt]);

  return (
    <div className="card wide" key="search">
      <h1>Search docs</h1>
      <div className="field" style={{ margin: "12px 0 8px" }}>
        <label htmlFor="search" className="sr-only">
          Search
        </label>
        <input
          id="search"
          type="search"
          placeholder="Search guides and API reference"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {state.name === "idle" && (
        <p className="empty">Try "webhooks" or "rate limits".</p>
      )}
      {state.name === "loading" && (
        <div aria-label="Loading results">
          <div className="skeleton" />
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      )}
      {state.name === "error" && (
        <div className="empty">
          <p>Search is having trouble right now.</p>
          <Button onClick={() => setAttempt(attempt + 1)}>Try again</Button>
        </div>
      )}
      {state.name === "results" && state.docs.length === 0 && (
        <p className="empty">
          No results for "{query}". Check the spelling or try a broader term.
        </p>
      )}
      {state.name === "results" && state.docs.length > 0 && (
        <ul className="results" aria-label="Results">
          {state.docs.map((doc) => (
            <li key={doc.id}>
              <div>{doc.title}</div>
              <div className="meta">{doc.meta}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
