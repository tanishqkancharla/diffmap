import { useState, type ReactNode } from "react";
import * as errore from "errore";
import {
  Avatar,
  Button,
  Flex,
  Menu,
  MenuItem,
  MenuTrigger,
  Text,
  TextField,
  backgroundColor,
  borderColor,
  colors,
  flex,
  focusRing,
  radius,
  spacing,
  text,
} from "maui";
import {
  Check,
  Close,
  DoubleChevronUpDown,
  Globe,
  Link,
  Lock,
  Users,
  WarningTriangle,
} from "maui/icons";
import { style, useStyles } from "purse-styles";

/**
 * Proposed in .diffmap/specs/productdoc-sharing: the share dialog's form, modeled on Halo's ShareAppForm.
 * Nothing renders it yet outside its preview stories.
 */

export type Access = "restricted" | "public";

export type Account = { name: string; email: string };

/** A document that already has a link. */
export type SharedDocument = {
  link: string;
  access: Access;
  people: string[];
  updated: string;
  /** Pages changed locally since the version at the link. */
  unpublished: number;
};

/** What the dialog asks of the local server. */
export type ShareApi = {
  /** Starts device sign-in; the person approves `code` at `url` in a popup. */
  startSignIn(): Promise<{ code: string; url: string }>;
  /** Resolves once the person approves the code. */
  signedIn(): Promise<Account>;
  /** Uploads the document's current pages as a new version with this access, and resolves with the link. */
  share(request: {
    access: Access;
    people: string[];
  }): Promise<{ link: string } | { error: string }>;
};

type Phase =
  | { name: "idle" }
  | { name: "signing-in"; code: string }
  | { name: "sharing" }
  | { name: "failed"; reason: string };

const options = [
  {
    id: "restricted" as const,
    title: "Restricted",
    description: "Only people you’ve added get access",
  },
  {
    id: "public" as const,
    title: "Public",
    description: "Anyone with the link has access",
  },
];

class CopyError extends errore.createTaggedError({
  name: "CopyError",
  message: "Could not copy the link",
}) {}

const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export function ShareForm(props: {
  title: string;
  /** The signed-in account, or undefined before the first share. */
  account: Account | undefined;
  /** The owner shown in the people list, signed in or not. */
  owner: Account;
  shared: SharedDocument | undefined;
  /** What sharing uploads, such as "7 pages, 4 screenshots, 1 recording (6.2 MB)". */
  contents: string;
  sourceFiles: string[];
  cover: ReactNode;
  /** Which build phases have landed. */
  features: { restricted: boolean };
  api: ShareApi;
  onClose(): void;
}) {
  const [account, setAccount] = useState(props.account);
  const [shared, setShared] = useState(props.shared);
  const [access, setAccess] = useState<Access>(
    props.shared?.access ??
      (props.features.restricted ? "restricted" : "public"),
  );
  const [people, setPeople] = useState(props.shared?.people ?? []);
  const [email, setEmail] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [copied, setCopied] = useState(false);
  const [phase, setPhase] = useState<Phase>({ name: "idle" });

  const card = useStyles(styles.card);
  const body = useStyles(styles.body);
  const heading = useStyles(styles.heading);
  const picker = useStyles(styles.picker);
  const row = useStyles(styles.row);
  const list = useStyles(styles.people);
  const remove = useStyles(styles.remove);
  const banner = useStyles(styles.banner);
  const error = useStyles(styles.error);
  const footer = useStyles(styles.footer);
  const team = useStyles(styles.team);

  const busy = phase.name === "signing-in" || phase.name === "sharing";
  const savedAccess = shared?.access;
  const savedPeople = shared?.people ?? [];
  const added = people.filter((person) => !savedPeople.includes(person));
  const removed = savedPeople.filter((person) => !people.includes(person));
  const changed =
    shared === undefined ||
    access !== savedAccess ||
    added.length > 0 ||
    removed.length > 0 ||
    shared.unpublished > 0;
  const canShare = access === "public" || people.length > 0;
  const actionLabel =
    shared === undefined
      ? access === "public"
        ? "Share"
        : people.length > 0
          ? `Share with ${plural(people.length, "person", "people")}`
          : "Share"
      : access !== savedAccess
        ? access === "public"
          ? "Make public"
          : "Restrict access"
        : added.length > 0 && removed.length > 0
          ? "Update access"
          : added.length > 0
            ? `Share with ${plural(added.length, "person", "people")}`
            : removed.length > 0
              ? `Unshare with ${plural(removed.length, "person", "people")}`
              : changed
                ? `Publish ${plural(shared.unpublished, "edit", "edits")}`
                : "Done";

  const upload = async () => {
    setPhase({ name: "sharing" });
    const result = await props.api.share({ access, people });
    if ("error" in result) {
      setPhase({ name: "failed", reason: result.error });
      return;
    }
    setShared({
      link: result.link,
      access,
      people,
      updated: "just now",
      unpublished: 0,
    });
    setPhase({ name: "idle" });
  };

  const submit = async () => {
    if (!changed) {
      props.onClose();
      return;
    }
    if (account === undefined) {
      const { code } = await props.api.startSignIn();
      setPhase({ name: "signing-in", code });
      setAccount(await props.api.signedIn());
    }
    await upload();
  };

  const copy = async () => {
    if (shared === undefined) return;
    const result = await navigator.clipboard
      .writeText(shared.link)
      .catch((cause) => new CopyError({ cause }));
    if (result instanceof Error) {
      console.warn("Could not copy the link", result);
      return;
    }
    setCopied(true);
  };

  return (
    <section className={card} aria-label={`Share ${props.title}`}>
      <div className={body}>
        <Flex row alignItems="center" justifyContent="between">
          <h2 className={heading}>Share “{props.title}”</h2>
          <Button
            variant="quiet"
            aria-label="Close sharing"
            isDisabled={busy}
            onPress={props.onClose}
          >
            <Close size="sm" />
          </Button>
        </Flex>

        {access === "public" && (
          <BrowserFrame link={shared?.link}>{props.cover}</BrowserFrame>
        )}

        <Flex column gap={2}>
          <Text size="xs" color="lowContrast">
            Access
          </Text>
          <MenuTrigger>
            <Button
              className={picker}
              aria-label={`Access: ${access === "public" ? "Public" : "Restricted"}`}
              isDisabled={busy}
            >
              {access === "public" ? <Globe size="md" /> : <Lock size="md" />}
              <AccessLabel access={access} />
              <DoubleChevronUpDown size="sm" />
            </Button>
            <Menu
              onAction={(key) => {
                if (key === "public" || key === "restricted") setAccess(key);
              }}
              selectionMode="single"
              selectedKeys={[access]}
              disabledKeys={props.features.restricted ? [] : ["restricted"]}
            >
              {options.map((option) => (
                <MenuItem
                  key={option.id}
                  id={option.id}
                  textValue={option.title}
                >
                  <Flex row gap={4} alignItems="start">
                    {option.id === "public" ? (
                      <Globe size="sm" />
                    ) : (
                      <Lock size="sm" />
                    )}
                    <AccessLabel access={option.id} />
                  </Flex>
                </MenuItem>
              ))}
            </Menu>
          </MenuTrigger>
        </Flex>

        {access === "restricted" && (
          <>
            <form
              className={row}
              onSubmit={(event) => {
                event.preventDefault();
                const entry = email.trim().toLowerCase();
                if (!validEmail(entry)) {
                  setInvalid(true);
                  return;
                }
                setPeople((previous) => [...new Set([...previous, entry])]);
                setEmail("");
              }}
            >
              <TextField
                aria-label="Add people by email"
                placeholder="Add people by email"
                value={email}
                isDisabled={busy}
                isInvalid={invalid}
                errorMessage={
                  invalid
                    ? "Enter a full email, like name@example.com."
                    : undefined
                }
                onChange={(value) => {
                  setEmail(value);
                  setInvalid(false);
                }}
              />
              <Button
                type="submit"
                variant="primary"
                isDisabled={busy || email.trim() === ""}
              >
                Add
              </Button>
            </form>
            <Flex column gap={2}>
              <Text size="xs" color="lowContrast">
                {added.length > 0 || removed.length > 0
                  ? "People · invitations send when you share"
                  : "People with access"}
              </Text>
              <ul className={list} aria-label="People with access">
                <li>
                  <Avatar name={props.owner.name} size="lg" />
                  <PersonLabel
                    name={`${props.owner.name} (you)`}
                    detail={props.owner.email}
                  />
                  <Text size="xs" color="lowContrast">
                    Owner
                  </Text>
                </li>
                {people.map((person) => (
                  <li key={person}>
                    <Avatar name={person} size="lg" />
                    <PersonLabel
                      name={person}
                      detail={
                        savedPeople.includes(person)
                          ? undefined
                          : "Invited when you share"
                      }
                    />
                    <Button
                      className={remove}
                      variant="quiet"
                      size="sm"
                      aria-label={`Remove ${person}`}
                      isDisabled={busy}
                      onPress={() =>
                        setPeople((previous) =>
                          previous.filter((entry) => entry !== person),
                        )
                      }
                    >
                      <Close size="xs" />
                    </Button>
                  </li>
                ))}
              </ul>
            </Flex>
          </>
        )}

        <div className={team} aria-disabled="true">
          <Users size="sm" />
          <Text size="sm" color="lowContrast" style={{ flex: 1 }}>
            Share with team
          </Text>
          <Text size="xs" color="lowContrast">
            Coming soon
          </Text>
        </div>

        <Text size="xs" color="lowContrast" style={{ whiteSpace: "normal" }}>
          Uploads {props.contents}, and{" "}
          {plural(props.sourceFiles.length, "source file", "source files")}{" "}
          {access === "public"
            ? "anyone with the link can read"
            : "the people you add can read"}
          : {props.sourceFiles.join(", ")}
        </Text>

        {phase.name === "signing-in" && (
          <div className={banner} role="status">
            <Text size="sm" style={{ whiteSpace: "normal" }}>
              Sign in to productdoc.dev in the popup with Google or GitHub, and
              check it shows <strong>{phase.code}</strong>.
            </Text>
          </div>
        )}
        {phase.name === "sharing" && (
          <div className={banner} role="status">
            <Text size="sm">Uploading {props.contents}…</Text>
          </div>
        )}
        {phase.name === "failed" && (
          <div className={error} role="alert">
            <WarningTriangle size="sm" />
            <Text size="sm" style={{ whiteSpace: "normal" }}>
              Couldn’t share. {phase.reason}
            </Text>
          </div>
        )}
        {shared !== undefined && phase.name === "idle" && (
          <Text size="xs" color="lowContrast" role="status">
            {shared.unpublished > 0
              ? `Shared · ${plural(shared.unpublished, "edit", "edits")} not published yet`
              : `Shared · up to date · published ${shared.updated}`}
          </Text>
        )}
      </div>
      <div className={footer}>
        <Button isDisabled={shared === undefined} onPress={() => void copy()}>
          {copied ? <Check size="sm" /> : <Link size="sm" />}
          {copied ? "Copied" : "Copy link"}
        </Button>
        <Button
          variant="primary"
          isDisabled={!canShare && changed}
          isPending={busy}
          onPress={() => void submit()}
        >
          {phase.name === "signing-in"
            ? "Signing in…"
            : phase.name === "sharing"
              ? "Sharing…"
              : phase.name === "failed"
                ? "Retry"
                : actionLabel}
        </Button>
      </div>
    </section>
  );
}

function plural(count: number, one: string, many: string) {
  return `${String(count)} ${count === 1 ? one : many}`;
}

function AccessLabel({ access }: { access: Access }) {
  const option = options.find((entry) => entry.id === access)!;
  return (
    <Flex column style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
      <Text size="sm" fontWeight={500}>
        {option.title}
      </Text>
      <Text size="xs" color="lowContrast" style={{ whiteSpace: "normal" }}>
        {option.description}
      </Text>
    </Flex>
  );
}

function PersonLabel(props: { name: string; detail: string | undefined }) {
  const label = useStyles(styles.personLabel);
  return (
    <span className={label}>
      <Text size="sm">{props.name}</Text>
      {props.detail !== undefined && (
        <Text size="xs" color="lowContrast">
          {props.detail}
        </Text>
      )}
    </span>
  );
}

function BrowserFrame(props: {
  link: string | undefined;
  children: ReactNode;
}) {
  const preview = useStyles(styles.preview);
  const browser = useStyles(styles.browser);
  const chrome = useStyles(styles.chrome);
  const address = useStyles(styles.address);
  const dot = useStyles(styles.dot);
  return (
    <div className={preview} role="img" aria-label="How the link will look">
      <div className={browser} aria-hidden="true" inert>
        <div className={chrome}>
          <i className={dot} />
          <i className={dot} />
          <i className={dot} />
          <div className={address}>
            <Globe size="xs" />
            <Text size="xs" color="lowContrast">
              {props.link === undefined
                ? "productdoc.dev/d/8f3k2x…"
                : props.link.replace(/^https:\/\//, "")}
            </Text>
          </div>
        </div>
        {props.children}
      </div>
    </div>
  );
}

const styles = {
  card: style(radius.lg, {
    border: `1px solid ${borderColor.outline}`,
    backgroundColor: backgroundColor.element,
    display: "flex",
    flexDirection: "column",
    width: 440,
    boxSizing: "border-box",
  }),
  body: style(
    flex({ direction: "column", gap: 6 }),
    spacing.padding({ x: 8, y: 6 }),
  ),
  heading: style(text({ size: "md", fontWeight: 500 }), { margin: 0 }),
  picker: style(spacing.padding({ x: 4, y: 3 }), {
    width: "100%",
    height: "auto",
    minHeight: 52,
    justifyContent: "start",
    "& > svg:first-child": { alignSelf: "start", marginTop: 1 },
    "& > svg:last-child": { marginLeft: "auto" },
  }),
  row: style(flex({ alignItems: "start", gap: 3 }), {
    "& > :first-child": { flex: 1, minWidth: 0 },
  }),
  people: style(focusRing(), flex({ direction: "column", gap: 2 }), {
    margin: 0,
    padding: 2,
    listStyle: "none",
    "& > li": {
      display: "flex",
      alignItems: "center",
      gap: spacing.value(4),
      minHeight: 40,
    },
    "& > li > svg": { flexShrink: 0 },
  }),
  personLabel: style(flex({ direction: "column" }), {
    flex: 1,
    minWidth: 0,
    "& > span": {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  }),
  remove: style({ flexShrink: 0 }),
  team: style(
    radius.sm,
    flex({ alignItems: "center", gap: 3 }),
    spacing.padding({ x: 4, y: 3 }),
    {
      border: `1px dashed ${borderColor.border}`,
      color: colors.gray[9],
    },
  ),
  banner: style(radius.sm, spacing.padding({ all: 4 }), {
    backgroundColor: backgroundColor.elementHover,
    border: `1px solid ${borderColor.border}`,
  }),
  error: style(
    radius.sm,
    flex({ alignItems: "start", gap: 3 }),
    spacing.padding({ all: 4 }),
    {
      backgroundColor: colors.orange[2],
      color: colors.orange[11],
      border: `1px solid ${colors.orange[6]}`,
      "& > svg": { flexShrink: 0 },
    },
  ),
  footer: style(
    flex({ alignItems: "center", justifyContent: "between" }),
    spacing.padding({ x: 8, bottom: 6 }),
  ),
  preview: style({
    height: 150,
    overflow: "hidden",
    pointerEvents: "none",
    maskImage: "linear-gradient(to bottom, black 60%, transparent 100%)",
  }),
  browser: style(radius.lg, {
    minHeight: "100%",
    overflow: "hidden",
    border: `1px solid ${borderColor.outline}`,
    backgroundColor: backgroundColor.app,
  }),
  chrome: style(
    flex({ alignItems: "center", gap: 2 }),
    spacing.padding({ x: 4, y: 3 }),
    {
      backgroundColor: backgroundColor.elementHover,
      borderBottom: `1px solid ${borderColor.border}`,
    },
  ),
  address: style(
    radius.sm,
    flex({ alignItems: "center", gap: 3 }),
    spacing.padding({ x: 3, y: 2 }),
    {
      flex: 1,
      minWidth: 0,
      height: 22,
      marginLeft: spacing.value(4),
      backgroundColor: backgroundColor.app,
      border: `1px solid ${borderColor.border}`,
    },
  ),
  dot: style(radius.circle, {
    width: 8,
    height: 8,
    backgroundColor: borderColor.outline,
  }),
};
