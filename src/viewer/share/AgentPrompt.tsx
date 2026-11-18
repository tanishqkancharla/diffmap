import { flex } from "maui";
import { style, useStyles } from "purse-styles";
import { styles as landing } from "../../landing/shared.tsx";
import { CodeBlock } from "../CodeBlock.tsx";

/** Proposed in .diffmap/specs/productdoc-sharing: a prompt the person copies to their agent to recover from an error. */
export function AgentPrompt(props: { prompt: string }) {
  const box = useStyles(styles.box);
  const label = useStyles(landing.label);
  return (
    <div className={box}>
      <span className={label}>Ask your agent</span>
      <CodeBlock
        lang="text"
        source={props.prompt}
        highlights={[]}
        notes={[]}
        title={undefined}
      />
    </div>
  );
}

const styles = {
  box: style(flex({ direction: "column", alignItems: "stretch", gap: 2 }), {
    width: "100%",
    "& > figure": { textAlign: "left" },
  }),
};
