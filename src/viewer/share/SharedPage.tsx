import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Banner,
  Button,
  Close,
  Lock,
  Menu,
  MenuItem,
  MenuTrigger,
  P,
  backgroundColor,
  border,
  flex,
  spacing,
  text,
} from "maui";
import { ChevronDown, Flag } from "maui/icons";
import { style, useStyles } from "purse-styles";
import { StatusPage } from "../StatusPage.tsx";
import { Logo } from "../../landing/Logo.tsx";
import { ProductdocWordmark } from "./ProductdocWordmark.tsx";
import { GitHubLogo, GoogleLogo } from "./ProviderLogos.tsx";
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
  /** The hosted viewer, with these actions in its header. */
  viewer: (headerActions: ReactNode) => ReactNode;
}) {
  const [reader, setReader] = useState(props.reader);
  const [viewing, setViewing] = useState(props.versions?.[0]);
  const page = useStyles(styles.page);
  const viewer = useStyles(styles.viewer);
  const wordmark = <ProductdocWordmark />;

  if (props.status !== "shared") {
    return (
      <StatusPage
        wordmark={wordmark}
        tone="neutral"
        icon={props.status === "stopped" ? Close : Flag}
        title={
          props.status === "stopped"
            ? `${props.owner} stopped sharing this document`
            : "This document was removed"
        }
      >
        <P>
          {props.status === "stopped"
            ? "Ask them for a new link if you still need it."
            : "It broke productdoc’s rules for shared documents."}
        </P>
      </StatusPage>
    );
  }

  if (props.access === "restricted" && reader === undefined) {
    const signIn = () => void props.api.signIn().then(setReader);
    return (
      <StatusPage
        wordmark={wordmark}
        tone="neutral"
        icon={Lock}
        title="Sign in to open this document"
        actions={
          <>
            <Button onPress={signIn}>
              <GoogleLogo />
              Continue with Google
            </Button>
            <Button onPress={signIn}>
              <GitHubLogo />
              Continue with GitHub
            </Button>
          </>
        }
      >
        <P>Use the email address it was shared with.</P>
      </StatusPage>
    );
  }

  if (
    props.access === "restricted" &&
    reader !== undefined &&
    !props.people.includes(reader.email)
  ) {
    return (
      <StatusPage
        wordmark={wordmark}
        tone="warning"
        icon={Lock}
        title="You don’t have access"
        actions={
          <>
            <Button onPress={() => setReader(undefined)}>Switch account</Button>
            <Button>Link another account</Button>
          </>
        }
      >
        <P>
          You’re signed in as {reader.email}. If it was shared with another
          address, switch accounts or link that account to this one.
        </P>
      </StatusPage>
    );
  }

  const latest = props.versions?.[0];
  const versions =
    props.versions !== undefined && viewing !== undefined ? (
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
    ) : undefined;

  return (
    <div className={page}>
      {props.access === "public" && <PublicBar owner={props.owner} />}
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
      <div className={viewer}>{props.viewer(versions)}</div>
    </div>
  );
}

/**
 * Says who shared a public document, with a link to productdoc.dev. It slides
 * away while the reader scrolls down, comes back when they scroll up, and the
 * reader can close it for good.
 */
function PublicBar(props: { owner: string }) {
  const [closed, setClosed] = useState(false);
  const [hidden, setHidden] = useState(false);
  const last = useRef(0);
  const bar = useStyles(styles.bar);
  const brand = useStyles(styles.brand);
  const wide = useStyles(styles.wide);
  const owner = useStyles(styles.owner);
  const link = useStyles(styles.link);
  const close = useStyles(styles.close);

  useEffect(() => {
    // The viewer scrolls inside its own panes, so listen for any scroll on the page.
    const onScroll = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const top = target.scrollTop;
      if (Math.abs(top - last.current) < 8) return;
      setHidden(top > last.current && top > 48);
      last.current = top;
    };
    document.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    });
    return () =>
      document.removeEventListener("scroll", onScroll, { capture: true });
  }, []);

  if (closed) return undefined;
  return (
    <div className={bar} data-hidden={hidden}>
      <a
        className={brand}
        href="https://productdoc.dev"
        aria-label="productdoc"
      >
        <Logo size={20} />
        <span className={wide}>productdoc</span>
      </a>
      <span className={owner}>
        {props.owner} shared this<span className={wide}> publicly</span>
      </span>
      <a className={link} href="https://productdoc.dev">
        Share<span className={wide}> yours</span> →
      </a>
      <Button
        variant="quiet"
        size="sm"
        aria-label="Close"
        className={close}
        onPress={() => setClosed(true)}
      >
        <Close size="xs" />
      </Button>
    </div>
  );
}

const styles = {
  page: style(flex({ direction: "column" }), {
    height: "100vh",
    overflow: "hidden",
    backgroundColor: backgroundColor.app,
  }),
  bar: style(
    flex({ direction: "row", alignItems: "center", gap: 2 }),
    spacing.padding({ left: 4, right: 1, y: 1 }),
    border(["bottom"], "border"),
    text({ size: "sm", fontWeight: 600, color: "highContrast" }),
    {
      flexShrink: 0,
      minWidth: 0,
      maxHeight: "48px",
      overflow: "hidden",
      whiteSpace: "nowrap",
      backgroundColor: backgroundColor.elementHover,
      transition:
        "max-height 160ms ease, padding 160ms ease, border-width 160ms ease",
      "&[data-hidden='true']": {
        maxHeight: 0,
        paddingBlock: 0,
        borderBottomWidth: 0,
      },
      "@media (prefers-reduced-motion: reduce)": { transition: "none" },
    },
  ),
  // On a phone the logo stands in for the name, so the owner's name fits.
  wide: style({ "@media (max-width: 480px)": { display: "none" } }),
  brand: style(flex({ direction: "row", alignItems: "center", gap: 2 }), {
    flexShrink: 0,
    color: "inherit",
    textDecoration: "none",
  }),
  // The owner's name gives way first on a narrow screen.
  owner: style(text({ size: "sm", fontWeight: 400, color: "lowContrast" }), {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
  }),
  link: style(text({ size: "sm", fontWeight: 500 }), {
    marginLeft: "auto",
    flexShrink: 0,
    color: "inherit",
  }),
  close: style({ flexShrink: 0 }),
  // The viewer fills the viewport, so it scrolls inside what is left under the bar.
  viewer: style({
    flex: "1 1 auto",
    minHeight: 0,
    overflow: "hidden",
    "& > div": { height: "100%" },
  }),
};
