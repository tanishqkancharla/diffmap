import type { Meta, StoryObj } from "@storybook/react";
import { delay, http, HttpResponse } from "msw";
import { Upload } from "./Upload";

const meta = {
  title: "Billing/Upload statement",
  component: Upload,
} satisfies Meta<typeof Upload>;
export default meta;
type Story = StoryObj<typeof meta>;

const uploads = (status: number, wait: number | "infinite") =>
  http.post("/api/uploads", async () => {
    await delay(wait);
    return HttpResponse.json({}, { status });
  });

const statement = (bytes: number, name = "march-statement.pdf") =>
  new File([new Uint8Array(bytes)], name, { type: "application/pdf" });

export const Empty: Story = {};

export const Uploading: Story = {
  parameters: { msw: { handlers: [uploads(200, "infinite")] } },
  play: async ({ canvas, userEvent }) => {
    await userEvent.upload(
      canvas.getByLabelText("Statement file"),
      statement(2_400_000),
    );
    await canvas.findByRole("progressbar");
  },
};

export const Uploaded: Story = {
  parameters: { msw: { handlers: [uploads(200, 1600)] } },
  play: async ({ canvas, userEvent }) => {
    await userEvent.upload(
      canvas.getByLabelText("Statement file"),
      statement(2_400_000),
    );
    await canvas.findByText(/Uploaded/, undefined, { timeout: 4000 });
  },
};

export const TooLarge: Story = {
  parameters: {
    msw: { handlers: [uploads(413, 400)] },
    docs: {
      description: {
        story:
          "The server rejects files over 10 MB, and says how big this one was.",
      },
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.upload(
      canvas.getByLabelText("Statement file"),
      statement(14_200_000, "annual-report.pdf"),
    );
    await canvas.findByText(/Files can be up to/);
  },
};

export const ConnectionDropped: Story = {
  parameters: { msw: { handlers: [uploads(500, 1200)] } },
  play: async ({ canvas, userEvent }) => {
    await userEvent.upload(
      canvas.getByLabelText("Statement file"),
      statement(2_400_000),
    );
    await canvas.findByText(/stopped partway/, undefined, { timeout: 4000 });
  },
};
