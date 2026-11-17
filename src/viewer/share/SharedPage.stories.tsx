import type { Meta, StoryObj } from "@storybook/react";
import { Flex, Text } from "maui";
import { within } from "storybook/test";
import type { Account } from "./ShareForm.tsx";
import { SharedPage, type SharedPageApi } from "./SharedPage.tsx";

const invited: Account = { name: "Ada", email: "ada@acme.com" };
const personal: Account = { name: "Ada", email: "ada@gmail.com" };

/** Stands in for productdoc.dev. A step's loader picks which account the reader signs in with. */
let next: Account = invited;
const api: SharedPageApi = {
  signIn: async () => next,
  report: async () => {},
};

function Document() {
  return (
    <Flex column px={4} gap={3}>
      <Text size="lg" fontWeight={600}>
        Session store
      </Text>
      <Text size="sm" color="lowContrast" style={{ whiteSpace: "normal" }}>
        Sessions move from memory into Postgres, so a deploy no longer signs
        everyone out.
      </Text>
    </Flex>
  );
}

const versions = [
  { n: 7, published: "5 minutes ago" },
  { n: 6, published: "2 hours ago" },
  { n: 5, published: "yesterday" },
];

const meta = {
  title: "Share/Shared page",
  component: SharedPage,
  args: {
    title: "Session store",
    owner: "Tanishq",
    status: "shared",
    access: "public",
    reader: undefined,
    people: ["ada@acme.com", "grace@acme.com"],
    versions: undefined,
    api,
    children: <Document />,
  },
} satisfies Meta<typeof SharedPage>;
export default meta;
type Story = StoryObj<typeof meta>;

const note = (story: string) => ({ docs: { description: { story } } });

export const Public: Story = {
  parameters: note(
    "Proposed. A reader opens a public link without signing in. The hosted viewer shows the document under a header with its title and Report.",
  ),
};

export const ReportOpen: Story = {
  parameters: note("Proposed. The reader says what's wrong."),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Report" }));
    await canvas.findByLabelText("What's wrong?");
  },
};

export const Reported: Story = {
  parameters: note(
    "Proposed. The report reaches an admin, who can take the document down.",
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText("What's wrong?"), "Spam");
    await userEvent.click(canvas.getByRole("button", { name: "Send report" }));
    await canvas.findByText("Thanks. An admin will review this document.");
  },
};

export const Stopped: Story = {
  args: { status: "stopped" },
  parameters: note("Proposed. The owner stopped sharing the document."),
};

export const Removed: Story = {
  args: { status: "removed" },
  parameters: note("Proposed. An admin took the document down."),
};

export const WithVersions: Story = {
  args: { versions },
  parameters: note(
    "Proposed, once links keep their versions. The header says when the link last updated.",
  ),
};

export const VersionsOpen: Story = {
  parameters: note("Proposed. Earlier versions stay readable."),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Versions" }));
    await within(document.body).findByRole("menu");
  },
};

export const OldVersion: Story = {
  parameters: note(
    "Proposed. The reader is on version 6. Its link always shows version 6, so it can go in a review.",
  ),
  play: async ({ userEvent }) => {
    const menu = within(document.body).getByRole("menu");
    await userEvent.click(within(menu).getByText(/^Version 6/));
    await within(document.body).findByText(/You’re viewing version 6/);
  },
};

export const RestrictedSignedOut: Story = {
  args: { access: "restricted" },
  parameters: note(
    "Proposed, once Restricted lands. The page doesn't say whether the document exists until the reader signs in.",
  ),
};

export const InvitedSignedIn: Story = {
  parameters: note(
    "Proposed. ada@acme.com was invited, so the document opens.",
  ),
  loaders: [() => void (next = invited)],
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Continue with Google" }),
    );
    await canvas.findByText("Session store", { selector: "span" });
  },
};

export const WrongAccount: Story = {
  parameters: note(
    "Proposed. The reader signed in with a personal address that wasn't invited. They can switch accounts, or link the invited one.",
  ),
  loaders: [() => void (next = personal)],
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Continue with Google" }),
    );
    await canvas.findByText("You don’t have access");
  },
};
