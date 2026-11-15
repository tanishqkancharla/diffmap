import type { Meta, StoryObj } from "@storybook/react";
import { delay, http, HttpResponse } from "msw";
import { Signup } from "./Signup";

const meta = { title: "Auth/Sign up", component: Signup } satisfies Meta<
  typeof Signup
>;
export default meta;
type Story = StoryObj<typeof meta>;

const signup = (status: number) =>
  http.post("/api/signup", async () => {
    await delay(800);
    return HttpResponse.json({}, { status });
  });

export const Empty: Story = {};

export const WeakPassword: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "The meter updates as you type, and Create account stays off until the password is okay.",
      },
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText("Full name"), "Ada Lovelace");
    await userEvent.type(canvas.getByLabelText("Work email"), "ada@acme.com");
    await userEvent.type(canvas.getByLabelText("Password"), "ada123");
  },
};

export const StrongPassword: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText("Password"), "!Engine-1843");
  },
};

export const EmailTaken: Story = {
  parameters: {
    msw: { handlers: [signup(409)] },
    docs: { description: { story: "The email already has an account." } },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Create account" }),
    );
    await canvas.findByText(/already exists/);
  },
};

export const VerifyEmail: Story = {
  parameters: { msw: { handlers: [signup(201)] } },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Create account" }),
    );
    await canvas.findByText("Verify your email");
  },
};

export const ServerDown: Story = {
  parameters: { msw: { handlers: [signup(500)] } },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Create account" }),
    );
    await canvas.findByText(/Something went wrong/);
  },
};
