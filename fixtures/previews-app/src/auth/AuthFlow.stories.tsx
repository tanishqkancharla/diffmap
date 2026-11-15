import type { Meta, StoryObj } from "@storybook/react";
import { delay, http, HttpResponse } from "msw";
import { expect } from "storybook/test";
import { AuthFlow } from "./AuthFlow";

const meta = { title: "Auth/Log in", component: AuthFlow } satisfies Meta<
  typeof AuthFlow
>;
export default meta;
type Story = StoryObj<typeof meta>;

const login = (status: number, body: object = {}) =>
  http.post("/api/login", async () => {
    await delay(700);
    return HttpResponse.json(body, { status });
  });

// Each story after Empty is one step from the story before it in the log-in flow: what the person does, and how the server answers.

export const Empty: Story = {
  parameters: {
    docs: { description: { story: "Where every visit to /login starts." } },
  },
};

export const InvalidEmail: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "The email is checked when the field loses focus, before anything is sent.",
      },
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText("Email"), "ada@acme");
    await userEvent.tab();
    await expect(await canvas.findByRole("alert")).toBeVisible();
  },
};

export const Filled: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText("Email"), "ada@acme.com");
    await userEvent.type(canvas.getByLabelText("Password"), "correct-horse");
  },
};

export const WrongPassword: Story = {
  parameters: {
    msw: { handlers: [login(401)] },
    docs: {
      description: {
        story:
          "The server says the password is wrong. The form keeps the email and clears nothing.",
      },
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Log in" }));
    await canvas.findByText("That email and password don't match.");
  },
};

export const Locked: Story = {
  parameters: {
    msw: { handlers: [login(429)] },
    docs: {
      description: {
        story: "After five failed tries, the server refuses for 5 minutes.",
      },
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Log in" }));
    await canvas.findByText("Too many attempts. Try again in 5 minutes.");
  },
};

export const TwoFactor: Story = {
  parameters: {
    msw: { handlers: [login(202, { twoFactor: true })] },
    docs: {
      description: { story: "Accounts with 2-factor on get a code screen." },
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Log in" }));
    await canvas.findByText("Enter your code");
  },
};

export const SignedIn: Story = {
  parameters: {
    msw: {
      handlers: [
        http.post("/api/login/verify", async () => {
          await delay(500);
          return HttpResponse.json({ name: "Ada" });
        }),
      ],
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText("Code"), "481516");
    await userEvent.click(canvas.getByRole("button", { name: "Verify" }));
    await canvas.findByText("Welcome back, Ada");
  },
};

export const Forgot: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Forgot password?" }),
    );
    await canvas.findByText("Reset your password");
  },
};

export const ResetSent: Story = {
  parameters: {
    msw: {
      handlers: [
        http.post("/api/password-reset", async () => {
          await delay(600);
          return HttpResponse.json({});
        }),
      ],
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText("Email"), "ada@acme.com");
    await userEvent.click(
      canvas.getByRole("button", { name: "Send reset link" }),
    );
    await canvas.findByText("Check your email");
  },
};
