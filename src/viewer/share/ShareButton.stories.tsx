import type { Meta, StoryObj } from "@storybook/react";
import { Button, Flex } from "maui";
import { ShareButton, type ShareState } from "./ShareButton.tsx";

/** The right end of the local viewer's header: the Diff button, then Share. */
function Header(props: { state: ShareState }) {
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

const note = (story: string) => ({ docs: { description: { story } } });

export const NotShared: Story = {
  args: { state: "not-shared" },
  parameters: note("Proposed. A quiet Share button beside the Diff button."),
};

export const Shared: Story = {
  args: { state: "shared" },
  parameters: note(
    "Proposed. After sharing, the button reads Shared. The link shows the version last shared.",
  ),
};

export const Live: Story = {
  args: { state: "live" },
  parameters: note(
    "Proposed, once links can be live. While the link follows each edit, the button reads Shared · Live, with a green dot.",
  ),
};
