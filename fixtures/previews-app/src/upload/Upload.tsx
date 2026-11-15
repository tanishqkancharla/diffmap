import { useEffect, useRef, useState } from "react";
import { Banner, Button } from "../ui";

type State =
  | { name: "empty" }
  | { name: "uploading"; file: File; percent: number }
  | { name: "done"; file: File }
  | { name: "failed"; file: File; reason: string };

const maxBytes = 10 * 1024 * 1024;

function size(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

export function Upload() {
  const [state, setState] = useState<State>({ name: "empty" });
  const input = useRef<HTMLInputElement>(null);

  // fetch reports no upload progress, so the bar eases toward 90% until the server answers.
  useEffect(() => {
    if (state.name !== "uploading") return;
    const timer = setInterval(
      () =>
        setState((current) =>
          current.name === "uploading"
            ? { ...current, percent: Math.min(90, current.percent + 7) }
            : current,
        ),
      120,
    );
    return () => clearInterval(timer);
  }, [state.name]);

  const upload = async (file: File) => {
    setState({ name: "uploading", file, percent: 4 });
    const body = new FormData();
    body.append("file", file);
    const response = await fetch("/api/uploads", { method: "POST", body });
    if (response.ok) setState({ name: "done", file });
    else
      setState({
        name: "failed",
        file,
        reason:
          response.status === 413
            ? `${file.name} is ${size(file.size)}. Files can be up to ${size(maxBytes)}.`
            : "The upload stopped partway. Check your connection and try again.",
      });
  };

  return (
    <div className="card" key="upload">
      <h1>Attach a statement</h1>
      <p className="lede">PDF or CSV, up to 10 MB.</p>
      <div className="stack">
        {state.name === "empty" && (
          <div className="drop">
            <span>Drag a file here, or</span>
            <Button onClick={() => input.current?.click()}>Choose file</Button>
          </div>
        )}
        <input
          ref={input}
          type="file"
          aria-label="Statement file"
          accept=".pdf,.csv"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file !== undefined) void upload(file);
          }}
        />
        {state.name !== "empty" && (
          <div className="stack" style={{ gap: 8 }}>
            <div className="file">
              <span>{state.file.name}</span>
              <span className="hint">{size(state.file.size)}</span>
            </div>
            {state.name === "uploading" && (
              <div
                className="progress"
                role="progressbar"
                aria-label="Upload progress"
                aria-valuenow={state.percent}
              >
                <span style={{ width: `${state.percent}%` }} />
              </div>
            )}
          </div>
        )}
        {state.name === "done" && (
          <Banner tone="success">
            Uploaded. We'll review it within a day.
          </Banner>
        )}
        {state.name === "failed" && (
          <>
            <Banner tone="danger">{state.reason}</Banner>
            <Button onClick={() => setState({ name: "empty" })}>
              Choose another file
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
