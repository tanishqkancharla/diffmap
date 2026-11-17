import type { Meta, StoryObj } from "@storybook/react";
import { Button, Flex } from "maui";
import { ShareButton } from "./ShareButton.tsx";

/** The right end of the local viewer's header: the Diff button, then Share. */
function Header(props: { state: "not-shared" | "live" | "paused" }) {
  return (
    <Flex row alignItems="center" gap={4}>
      <Button variant="quiet">Diff</Button>
      <ShareButton state={props.state} onPress={() => {}} />
    </Flex>
  );
}

const meta = {
  title: "Share/Header button",
  component: Header,
} satisfies Meta<typeof Header>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NotShared: Story = {
  args: { state: "not-shared" },
  parameters: {
    docs: {
      description: {
        story: "Proposed. A quiet Share button beside the Diff button.",
      },
    },
  },
};

export const SharedLive: Story = {
  args: { state: "live" },
  parameters: {
    docs: {
      description: {
        story:
          "Proposed. Once shared with Keep this link updated on, the header says the link follows each edit.",
      },
    },
  },
};

export const SharedPaused: Story = {
  args: { state: "paused" },
  parameters: {
    docs: {
      description: {
        story:
          "Proposed. With updates off, the link keeps the version last shared until the person shares again.",
      },
    },
  },
};
