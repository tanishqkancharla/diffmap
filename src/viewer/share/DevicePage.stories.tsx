import type { Meta, StoryObj } from "@storybook/react";
import { DevicePage, type DeviceApi } from "./DevicePage.tsx";

const account = { name: "Tanishq Kancharla", email: "tanishq@example.com" };

/** Stands in for productdoc.dev and Google: signing in and approving succeed at once. */
const api: DeviceApi = {
  signIn: async () => account,
  approve: async () => {},
  deny: async () => {},
};

const meta = {
  title: "Share/Device sign-in",
  component: DevicePage,
  args: { code: "4F2A-91BC", account: undefined, expired: false, api },
} satisfies Meta<typeof DevicePage>;
export default meta;
type Story = StoryObj<typeof meta>;

const note = (story: string) => ({ docs: { description: { story } } });

export const SignIn: Story = {
  parameters: note(
    "Proposed. The person opened the link the terminal printed, and isn't signed in to productdoc.dev yet.",
  ),
};

export const Confirm: Story = {
  parameters: note(
    "Proposed. They signed in with Google. The page shows the terminal's code so they can check it matches before allowing it.",
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Continue with Google" }),
    );
    await canvas.findByText("4F2A-91BC");
  },
};

export const Approved: Story = {
  parameters: note(
    "Proposed. The terminal picks up the sign-in and starts uploading.",
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Allow" }));
    await canvas.findByText("You’re signed in");
  },
};

export const Denied: Story = {
  parameters: note("Proposed. The terminal stops without uploading anything."),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Cancel" }));
    await canvas.findByText("Sign-in cancelled");
  },
};

export const Expired: Story = {
  args: { expired: true },
  parameters: note(
    "Proposed. The person opened the link after the code expired. The terminal has already given up.",
  ),
};
