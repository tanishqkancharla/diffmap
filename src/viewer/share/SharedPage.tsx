import { useState, type ReactNode } from "react";
import {
  Banner,
  Button,
  Flex,
  Menu,
  MenuItem,
  MenuTrigger,
  Text,
  backgroundColor,
  borderColor,
  flex,
  radius,
  spacing,
  text,
} from "maui";
import { ChevronDown, Github, Google, Lock } from "maui/icons";
import { style, useStyles } from "purse-styles";
import type { Access, Account } from "./ShareForm.tsx";

/**
 * Proposed in .diffmap/specs/productdoc-sharing: what a reader sees at productdoc.dev/d/<id>, around the
 * hosted viewer. Nothing renders it yet outside its preview stories.
 */

export type Version = { n: number; published: string };

export type SharedPageApi = {
  signIn(): Promise<Account>;
};

export function SharedPage(props: {
  title: string;
  owner: string;
  status: "shared" | "stopped" | "removed";
  access: Access;
  /** The signed-in reader, if any. */
  reader: Account | undefined;
  /** Emails a Restricted document is shared with. */
  people: string[];
  /** Newest first. Undefined until links keep their versions. */
  versions: Version[] | undefined;
  api: SharedPageApi;
  children: ReactNode;
}) {
  const [reader, setReader] = useState(props.reader);
  const [viewing, setViewing] = useState(props.versions?.[0]);
  const page = useStyles(styles.page);
  const header = useStyles(styles.header);
  const gate = useStyles(styles.gate);
  const heading = useStyles(styles.heading);

  if (props.status !== "shared") {
    return (
      <div className={page}>
        <section className={gate}>
          <h1 className={heading}>
            {props.status === "stopped"
              ? `${props.owner} stopped sharing this document`
              : "This document was removed"}
          </h1>
          <Text size="sm" color="lowContrast" style={{ whiteSpace: "normal" }}>
            {props.status === "stopped"
              ? "Ask them for a new link if you still need it."
              : "It broke productdoc's rules for shared content."}
          </Text>
        </section>
      </div>
    );
  }

  if (props.access === "restricted" && reader === undefined) {
    return (
      <div className={page}>
        <section className={gate}>
          <Lock size="md" />
          <h1 className={heading}>Sign in to open this document</h1>
          <Text size="sm" color="lowContrast" style={{ whiteSpace: "normal" }}>
            Use the email address it was shared with.
          </Text>
          <Flex column gap={3}>
            <Button onPress={() => void props.api.signIn().then(setReader)}>
              <Google size="sm" />
              Continue with Google
            </Button>
            <Button onPress={() => void props.api.signIn().then(setReader)}>
              <Github size="sm" />
              Continue with GitHub
            </Button>
          </Flex>
        </section>
      </div>
    );
  }

  if (
    props.access === "restricted" &&
    reader !== undefined &&
    !props.people.includes(reader.email)
  ) {
    return (
      <div className={page}>
        <section className={gate}>
          <Lock size="md" />
          <h1 className={heading}>You don’t have access</h1>
          <Text size="sm" color="lowContrast" style={{ whiteSpace: "normal" }}>
            You’re signed in as {reader.email}. If it was shared with another
            address, switch accounts or link that account to this one.
          </Text>
          <Flex row gap={3}>
            <Button onPress={() => setReader(undefined)}>Switch account</Button>
            <Button>Link another account</Button>
          </Flex>
        </section>
      </div>
    );
  }

  const latest = props.versions?.[0];
  return (
    <div className={page}>
      <header className={header}>
        <Text size="sm" fontWeight={600}>
          productdoc
        </Text>
        <Text size="sm" style={{ flex: 1, minWidth: 0 }}>
          {props.title}
        </Text>
        {props.versions !== undefined && viewing !== undefined && (
          <MenuTrigger>
            <Button variant="quiet" aria-label="Versions">
              {viewing === latest
                ? `Updated ${viewing.published}`
                : `Version ${String(viewing.n)}`}
              <ChevronDown size="xs" />
            </Button>
            <Menu
              selectionMode="single"
              selectedKeys={[String(viewing.n)]}
              onAction={(key) =>
                setViewing(props.versions!.find((v) => String(v.n) === key))
              }
            >
              {props.versions.map((version) => (
                <MenuItem
                  key={version.n}
                  id={String(version.n)}
                  textValue={`Version ${String(version.n)}`}
                >
                  Version {version.n} · {version.published}
                  {version === latest ? " (latest)" : ""}
                </MenuItem>
              ))}
            </Menu>
          </MenuTrigger>
        )}
      </header>
      {viewing !== undefined && viewing !== latest && (
        <Banner
          tone="info"
          actions={
            <Button size="sm" onPress={() => setViewing(latest)}>
              View latest
            </Button>
          }
        >
          You’re viewing version {viewing.n}, from {viewing.published}.
        </Banner>
      )}
      {props.children}
    </div>
  );
}

const styles = {
  page: style(
    flex({ direction: "column", gap: 4 }),
    spacing.padding({ all: 4 }),
    {
      width: "100%",
      maxWidth: 560,
      minHeight: 300,
      boxSizing: "border-box",
      backgroundColor: backgroundColor.app,
    },
  ),
  header: style(
    flex({ alignItems: "center", gap: 4 }),
    spacing.padding({ x: 4, y: 2 }),
    { borderBottom: `1px solid ${borderColor.border}` },
  ),
  gate: style(
    radius.lg,
    flex({ direction: "column", gap: 4 }),
    spacing.padding({ x: 8, y: 8 }),
    {
      alignSelf: "center",
      marginTop: spacing.value(8),
      width: "100%",
      maxWidth: 380,
      boxSizing: "border-box",
      border: `1px solid ${borderColor.outline}`,
      backgroundColor: backgroundColor.element,
    },
  ),
  heading: style(text({ size: "lg", fontWeight: 600 }), { margin: 0 }),
};
