import type { Meta, StoryObj } from "@storybook/react";
import { Banner, Button } from "./ui";

const meta = {
  title: "Design/Button",
  component: Button,
  args: { children: "Save changes" },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { primary: true } };

export const Secondary: Story = {};

export const Pending: Story = {
  args: { primary: true, pending: true, children: "Saving…" },
  parameters: {
    docs: {
      description: {
        story:
          "While a request is in flight: a spinner, and the button can't be pressed again.",
      },
    },
  },
};

export const Alerts: Story = {
  render: () => (
    <div className="stack" style={{ maxWidth: 380 }}>
      <Banner tone="danger">Your card was declined.</Banner>
      <Banner tone="success">Uploaded. We'll review it within a day.</Banner>
    </div>
  ),
};
