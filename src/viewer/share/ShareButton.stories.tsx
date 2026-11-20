import type { Meta, StoryObj } from "@storybook/react";
import { DemoViewer } from "./demoDocument.tsx";
import { ShareButton } from "./ShareButton.tsx";

/** The local viewer, with Share in its header after the Diff button. */
function Header(props: { shared: boolean; unpublished: number }) {
  return (
    <DemoViewer headerActions={<ShareButton {...props} onPress={() => {}} />} />
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
  args: { shared: false, unpublished: 0 },
  parameters: note("Proposed. A quiet Share button beside the Diff button."),
};

export const Shared: Story = {
  args: { shared: true, unpublished: 0 },
  parameters: note("Proposed. The link shows the latest edits."),
};

export const Unpublished: Story = {
  args: { shared: true, unpublished: 2 },
  parameters: note(
    "Proposed. Two pages changed since the last publish. Opening the dialog offers Publish 2 edits.",
  ),
};
