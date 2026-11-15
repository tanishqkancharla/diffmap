import type { Meta, StoryObj } from "@storybook/react";
import { delay, http, HttpResponse } from "msw";
import { Search } from "./Search";

const meta = { title: "Docs/Search", component: Search } satisfies Meta<
  typeof Search
>;
export default meta;
type Story = StoryObj<typeof meta>;

const docs = [
  { id: "1", title: "Receiving webhooks", meta: "Guide · 6 min read" },
  {
    id: "2",
    title: "Verifying webhook signatures",
    meta: "Guide · 4 min read",
  },
  { id: "3", title: "POST /v1/webhook_endpoints", meta: "API reference" },
];

const search = (response: () => Promise<Response>) =>
  http.get("/api/search", response);

export const Idle: Story = {};

export const Loading: Story = {
  parameters: {
    msw: {
      handlers: [
        search(async () => {
          await delay("infinite");
          return HttpResponse.json([]);
        }),
      ],
    },
    docs: {
      description: {
        story: "A slow search shows placeholders instead of an empty box.",
      },
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText("Search"), "webhooks");
    await canvas.findByLabelText("Loading results");
  },
};

export const Results: Story = {
  parameters: {
    msw: {
      handlers: [
        search(async () => {
          await delay(600);
          return HttpResponse.json(docs);
        }),
      ],
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText("Search"), "webhooks");
    await canvas.findByRole("list", { name: "Results" });
  },
};

export const NoResults: Story = {
  parameters: {
    msw: {
      handlers: [
        search(async () => {
          await delay(500);
          return HttpResponse.json([]);
        }),
      ],
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText("Search"), "webhoks");
    await canvas.findByText(/No results/);
  },
};

export const Failed: Story = {
  parameters: {
    msw: {
      handlers: [
        search(async () => {
          await delay(500);
          return new HttpResponse(null, { status: 503 });
        }),
      ],
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText("Search"), "webhooks");
    await canvas.findByText(/having trouble/);
  },
};

export const RetrySucceeds: Story = {
  parameters: {
    msw: {
      handlers: [
        search(async () => {
          await delay(600);
          return HttpResponse.json(docs);
        }),
      ],
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Try again" }));
    await canvas.findByRole("list", { name: "Results" });
  },
};
