import type { Meta, StoryObj } from "@storybook/react";
import { Flex, Text } from "maui";
import { within } from "storybook/test";
import { ShareForm, type Account, type ShareApi } from "./ShareForm.tsx";

const owner: Account = {
  name: "Tanishq Kancharla",
  email: "tanishq@example.com",
};
const link = "https://productdoc.dev/d/k3v9q2xa7m";

/**
 * Stands in for `product-doc serve` and productdoc.dev. Each story's loader says how they answer its step,
 * so events from outside the dialog, such as approving the code in the popup, are steps of their own.
 */
type UploadResult = { link: string } | { error: string };
const pending = () => {};
const server = (() => {
  let approve: (account: Account) => void = pending;
  let finish: (result: UploadResult) => void = pending;
  return {
    reset() {
      approve = pending;
      finish = pending;
    },
    approve() {
      approve(owner);
    },
    finishUpload(result: UploadResult) {
      finish(result);
    },
    api: {
      startSignIn: async () => ({
        code: "4F2A-91BC",
        url: "https://productdoc.dev/device?code=4F2A-91BC",
      }),
      signedIn: () => new Promise<Account>((resolve) => (approve = resolve)),
      share: () =>
        new Promise<{ link: string } | { error: string }>(
          (resolve) => (finish = resolve),
        ),
    } satisfies ShareApi,
  };
})();

function Cover() {
  return (
    <Flex column px={8} py={6} gap={3}>
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

const meta = {
  title: "Share/Dialog",
  component: ShareForm,
  args: {
    title: "Session store",
    account: undefined,
    owner,
    shared: undefined,
    contents: "7 pages, 4 screenshots, 1 recording (6.2 MB)",
    sourceFiles: ["src/store.ts", "src/session.ts", "src/store.test.ts"],
    cover: <Cover />,
    api: server.api,
    onClose: () => {},
  },
} satisfies Meta<typeof ShareForm>;
export default meta;
type Story = StoryObj<typeof meta>;

const note = (story: string) => ({ docs: { description: { story } } });

// Each story after FirstShare is one step from the story it follows in the flow.

export const FirstShare: Story = {
  loaders: [() => server.reset()],
  parameters: note(
    "Proposed. The person clicked Share in the viewer's header for the first time. Restricted is the default, so nothing becomes public unless they choose it. They aren't signed in yet; sharing asks them to.",
  ),
};

export const InvalidEmail: Story = {
  parameters: note(
    "Proposed. Adding checks the entry is a full address before it joins the list.",
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(
      canvas.getByLabelText("Add people by email"),
      "ada@acme",
    );
    await userEvent.click(canvas.getByRole("button", { name: "Add" }));
    await canvas.findByText("Enter a full email, like name@example.com.");
  },
};

export const PeopleAdded: Story = {
  parameters: note(
    "Proposed. Two people are on the list but not invited yet: invitations send when the person shares. The main button names the change.",
  ),
  play: async ({ canvas, userEvent }) => {
    const field = canvas.getByLabelText("Add people by email");
    await userEvent.type(field, "ada@acme.com");
    await userEvent.click(canvas.getByRole("button", { name: "Add" }));
    await userEvent.type(field, "grace@acme.com");
    await userEvent.click(canvas.getByRole("button", { name: "Add" }));
    await canvas.findByRole("button", { name: "Share with 2 people" });
  },
};

export const SigningIn: Story = {
  parameters: note(
    "Proposed. Sharing starts device sign-in on the local server and opens productdoc.dev in a popup with the code filled in. The dialog shows the same code so the person can check they match. Nothing is uploaded yet.",
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Share with 2 people" }),
    );
    await canvas.findByText("4F2A-91BC");
  },
};

export const Sharing: Story = {
  parameters: note(
    "Proposed. The person approved the code in the popup, so the local server holds a session token and uploads the document. The token never reaches this page.",
  ),
  loaders: [() => server.approve()],
  play: async ({ canvas }) => {
    await canvas.findByText(/^Uploading/);
  },
};

export const Shared: Story = {
  parameters: note(
    "Proposed. The upload finished. Ada and Grace get invitations, Copy link works, and the link follows the document while this viewer runs.",
  ),
  loaders: [() => server.finishUpload({ link })],
  play: async ({ canvas }) => {
    await canvas.findByText(/^Shared · updates as you edit/);
  },
};

export const UploadFailed: Story = {
  parameters: note(
    "Proposed. productdoc.dev refused the upload. The dialog says which file is over which limit, keeps the person's choices, and offers Retry.",
  ),
  loaders: [
    () =>
      server.finishUpload({
        error:
          "recording.mp4 is 41 MB; the limit is 25 MB. Trim it or remove it from the document.",
      }),
  ],
  play: async ({ canvas }) => {
    await canvas.findByRole("button", { name: "Retry" });
  },
};

export const ChoosePublic: Story = {
  parameters: note(
    "Proposed. Public needs no list of people. The note under the options says who can read the source files the document uploads.",
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Access: Restricted" }),
    );
    const menu = await within(document.body).findByRole("menu");
    await userEvent.click(within(menu).getByText("Public"));
    await canvas.findByRole("button", { name: "Access: Public" });
  },
};

export const AlreadyShared: Story = {
  parameters: note(
    "Proposed. Opening the dialog on a document already shared shows its link, who has access, and when it last updated.",
  ),
  args: {
    account: owner,
    shared: {
      link,
      access: "restricted",
      people: ["ada@acme.com", "grace@acme.com"],
      live: true,
      updated: "5 minutes ago",
    },
  },
};
