import type { Preview } from "@storybook/react";
import { initialize, mswLoader } from "msw-storybook-addon";
import "../src/app.css";

// Each story's parameters.msw.handlers answer the app's requests, so a story can show any server response.
initialize({ onUnhandledRequest: "bypass", quiet: true });

const preview: Preview = {
  loaders: [mswLoader],
  decorators: [
    (Story) => (
      <div className="acme">
        <Story />
      </div>
    ),
  ],
};

export default preview;
