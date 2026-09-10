import { useId, useState } from "react";
import type { CodeViewDiffItem } from "@pierre/diffs";
import type { Explanation } from "../explanations.js";
import type { SourceAnnotation } from "../annotations.js";
import { MermaidBlock } from "./MermaidBlock.js";
import { SourceDiffPanel, type SourceSelection } from "./SourceDiffPanel.js";
import { backgroundColor, colors } from "maui";
import { style, useStyles } from "purse-styles";
import "./exploration.css";

export function ExplorationPanel(props: {
  explanations: Record<string, Explanation>;
  items: CodeViewDiffItem[];
  selection: SourceSelection | undefined;
  history: SourceSelection[];
  onSelect: (annotation: SourceAnnotation) => void;
  onSource: (selection: SourceSelection) => void;
  onBack: () => void;
}) {
  const panelId = useId();
  const theme = useStyles(panelTheme);
  const explanation = props.selection?.annotation.explanationId
    ? props.explanations[props.selection.annotation.explanationId]
    : undefined;
  const [view, setView] = useState<{
    annotation: SourceAnnotation | undefined;
    tab: "explain" | "diagram" | "code";
  }>({
    annotation: props.selection?.annotation,
    tab: explanation ? "explain" : "code",
  });
  if (view.annotation !== props.selection?.annotation)
    setView({
      annotation: props.selection?.annotation,
      tab: explanation ? "explain" : "code",
    });
  const tab =
    view.annotation === props.selection?.annotation
      ? view.tab
      : explanation
        ? "explain"
        : "code";
  const open = (id: string) => {
    const item = props.explanations[id]!;
    props.onSelect({
      text: item.title,
      explanationId: id,
      references: item.references,
    });
  };
  const diagram = explanation?.diagram ? (
    <MermaidBlock
      source={explanation.diagram}
      annotations={explanation.annotations}
      selectedAnnotation={props.selection?.annotation}
      onSelectAnnotation={props.onSelect}
    />
  ) : undefined;
  return (
    <section
      id="exploration-panel"
      className={`exploration-panel ${theme}`}
      aria-label="Explanation, diagrams and code"
    >
      <header className="exploration-header">
        <div className="exploration-breadcrumb">
          <span>EXPLORE THE PROJECT</span>
          {props.history.length > 0 && (
            <button onClick={props.onBack}>← Back</button>
          )}
        </div>
        <h2>
          {explanation?.title ??
            props.selection?.annotation.text ??
            "Choose a step to explore"}
        </h2>
        <div
          className="exploration-tabs"
          role="tablist"
          aria-label="Detail view"
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
              return;
            const tabs = [
              ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
                "button:not(:disabled)",
              ),
            ];
            const current = tabs.indexOf(
              document.activeElement as HTMLButtonElement,
            );
            const next =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? tabs.length - 1
                  : (current +
                      (event.key === "ArrowRight" ? 1 : -1) +
                      tabs.length) %
                    tabs.length;
            event.preventDefault();
            tabs[next]?.focus();
            tabs[next]?.click();
          }}
        >
          {(["explain", "diagram", "code"] as const).map((name) => (
            <button
              key={name}
              role="tab"
              id={`${panelId}-${name}`}
              aria-controls={`${panelId}-content`}
              tabIndex={tab === name ? 0 : -1}
              aria-selected={tab === name}
              disabled={
                name === "diagram"
                  ? !diagram
                  : name === "explain"
                    ? !explanation
                    : !props.selection?.reference && props.items.length === 0
              }
              onClick={() =>
                setView({ annotation: props.selection?.annotation, tab: name })
              }
            >
              {name === "explain"
                ? "Explanation"
                : name === "diagram"
                  ? "Diagram"
                  : "Code"}
            </button>
          ))}
        </div>
      </header>
      <div
        className="exploration-tabpanel"
        id={`${panelId}-content`}
        role="tabpanel"
        aria-labelledby={`${panelId}-${tab}`}
      >
        {tab === "code" ? (
          <SourceDiffPanel
            items={props.items}
            selection={props.selection}
            onSelect={props.onSource}
          />
        ) : (
          <div className="exploration-content" key={explanation?.id + tab}>
            {explanation &&
              (tab === "diagram" ? (
                <>
                  <p>{explanation.summary}</p>
                  {diagram}
                  <p className="exploration-hint">
                    Click a linked step or arrow to go deeper. Use Back to
                    return.
                  </p>
                </>
              ) : (
                <>
                  <p className="exploration-summary">{explanation.summary}</p>
                  {explanation.why && (
                    <>
                      <h3>Why this happens</h3>
                      <p>{explanation.why}</p>
                    </>
                  )}
                  {(explanation.inputs || explanation.outputs) && (
                    <div className="exploration-io">
                      {explanation.inputs && (
                        <div>
                          <h3>What goes in</h3>
                          <p>{explanation.inputs}</p>
                        </div>
                      )}
                      {explanation.outputs && (
                        <div>
                          <h3>What comes back</h3>
                          <p>{explanation.outputs}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {explanation.steps.length > 0 && (
                    <>
                      <h3>What happens</h3>
                      <ol>
                        {explanation.steps.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                    </>
                  )}
                  {explanation.example && (
                    <div className="exploration-example">
                      <h3>A concrete example</h3>
                      <p>{explanation.example}</p>
                    </div>
                  )}
                  {diagram && (
                    <>
                      <h3>Look inside</h3>
                      {diagram}
                    </>
                  )}
                  {explanation.caveat && (
                    <>
                      <h3>A detail that matters</h3>
                      <p>{explanation.caveat}</p>
                    </>
                  )}
                </>
              ))}
            {explanation && explanation.related.length > 0 && (
              <nav
                className="exploration-related"
                aria-label="Explore related steps"
              >
                <h3>Keep exploring</h3>
                {explanation.related.map((id) => (
                  <button key={id} onClick={() => open(id)}>
                    {props.explanations[id]!.title} →
                  </button>
                ))}
              </nav>
            )}
            {!explanation && (
              <p>
                Click a linked step or arrow in the walkthrough to explore it.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

const panelTheme = style({
  "--explore-background": backgroundColor.app,
  "--explore-text": colors.gray[12],
  "--explore-muted": colors.gray[11],
  "--explore-border": colors.gray[6],
  "--explore-accent": colors.accent[11],
  "--explore-surface": backgroundColor.element,
  "--explore-focus": colors.accent[8],
});
