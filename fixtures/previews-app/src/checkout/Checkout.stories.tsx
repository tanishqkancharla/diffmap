import type { Meta, StoryObj } from "@storybook/react";
import { delay, http, HttpResponse } from "msw";
import { Checkout } from "./Checkout";

const meta = { title: "Shop/Checkout", component: Checkout } satisfies Meta<
  typeof Checkout
>;
export default meta;
type Story = StoryObj<typeof meta>;

const orders = (status: number, body: object = {}) =>
  http.post("/api/orders", async () => {
    await delay(1000);
    return HttpResponse.json(body, { status });
  });

export const Cart: Story = {};

export const Shipping: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Check out" }));
  },
};

export const Payment: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText("Full name"), "Ada Lovelace");
    await userEvent.type(
      canvas.getByLabelText("Street address"),
      "12 St James's Square",
    );
    await userEvent.type(canvas.getByLabelText("City"), "London");
    await userEvent.click(
      canvas.getByRole("button", { name: "Continue to payment" }),
    );
  },
};

export const Declined: Story = {
  parameters: {
    msw: { handlers: [orders(402)] },
    docs: {
      description: {
        story:
          "The card processor declines. The card number stays so it can be fixed.",
      },
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(
      canvas.getByLabelText("Card number"),
      "4000 0000 0000 0002",
    );
    await userEvent.click(canvas.getByRole("button", { name: /^Pay/ }));
    await canvas.findByText(/declined/);
  },
};

export const Placed: Story = {
  parameters: { msw: { handlers: [orders(200, { order: "#10482" })] } },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(
      canvas.getByLabelText("Card number"),
      "4242 4242 4242 4242",
    );
    await userEvent.click(canvas.getByRole("button", { name: /^Pay/ }));
    await canvas.findByText("Order placed");
  },
};

export const RetryAfterDecline: Story = {
  parameters: { msw: { handlers: [orders(200, { order: "#10483" })] } },
  play: async ({ canvas, userEvent }) => {
    const card = canvas.getByLabelText("Card number");
    await userEvent.clear(card);
    await userEvent.type(card, "4242 4242 4242 4242");
    await userEvent.click(canvas.getByRole("button", { name: /^Pay/ }));
    await canvas.findByText("Order placed");
  },
};
