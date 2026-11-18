import { useEffect, useState } from "react";
import { LinkBreak, P } from "maui";
import { StatusLoading, StatusPage } from "../../viewer/StatusPage.tsx";
import { DevicePage, type DeviceApi } from "../../viewer/share/DevicePage.tsx";
import { ProductdocWordmark } from "../../viewer/share/ProductdocWordmark.tsx";
import type { Account } from "../../viewer/share/ShareForm.tsx";
import { getJson, postJson, readConfig, readSession } from "./api.ts";

type State =
  | { kind: "loading" }
  | { kind: "no-code" }
  | {
      kind: "ready";
      code: string;
      account: Account | undefined;
      expired: boolean;
    };

/** productdoc.dev/device?user_code=…, where a person approves `product-doc login`. */
export function DeviceApp() {
  const [code] = useState(() =>
    new URLSearchParams(window.location.search).get("user_code")?.trim(),
  );
  const [state, setState] = useState<State>(
    code ? { kind: "loading" } : { kind: "no-code" },
  );

  useEffect(() => {
    if (!code) return;
    // oxlint-disable-next-line typescript/no-floating-promises -- The effect owns this load.
    void Promise.all([
      readSession(),
      getJson(
        `/api/auth/device?${new URLSearchParams({ user_code: code }).toString()}`,
      ),
    ]).then(([account, verified]) => {
      // Unknown codes are almost always ones Better Auth already cleaned up after they expired.
      const pending =
        !(verified instanceof Error) &&
        (verified as { status?: unknown }).status === "pending";
      setState({ kind: "ready", code, account, expired: !pending });
    });
  }, [code]);

  if (state.kind === "loading")
    return <StatusLoading label="Checking your sign-in code" />;
  if (state.kind === "no-code") {
    return (
      <StatusPage
        wordmark={<ProductdocWordmark />}
        tone="neutral"
        icon={LinkBreak}
        title="Open the link from your terminal"
      >
        <P>
          This page needs the sign-in code that product-doc printed. Open the
          whole link it gave you.
        </P>
      </StatusPage>
    );
  }
  return (
    <DevicePage
      code={state.code}
      account={state.account}
      expired={state.expired}
      api={deviceApi(state.code)}
    />
  );
}

function deviceApi(userCode: string): DeviceApi {
  return {
    async signIn(provider) {
      const config = await readConfig();
      if (config.devSignIn) {
        const email = window.prompt(
          "Development sign-in: email",
          "dev@productdoc.dev",
        );
        await postJson("/api/dev/sign-in", { email });
        const account = await readSession();
        if (account === undefined)
          throw new Error("Development sign-in failed");
        return account;
      }
      const started = await postJson("/api/auth/sign-in/social", {
        provider,
        callbackURL: window.location.href,
      });
      if (started instanceof Error) throw started;
      const url = (started as { url?: unknown }).url;
      if (typeof url !== "string") throw new Error("Sign-in didn't start");
      window.location.assign(url);
      // The page navigates away; the sign-in finishes when the provider sends the person back here.
      return new Promise<Account>(() => {});
    },
    async approve() {
      await claim(userCode);
      const result = await postJson("/api/auth/device/approve", { userCode });
      if (result instanceof Error) throw result;
    },
    async deny() {
      await claim(userCode);
      const result = await postJson("/api/auth/device/deny", { userCode });
      if (result instanceof Error) throw result;
    },
  };
}

/** Better Auth ties a code to whoever opens it signed in; only they can then approve or deny it. */
async function claim(userCode: string) {
  const claimed = await getJson(
    `/api/auth/device?${new URLSearchParams({ user_code: userCode }).toString()}`,
  );
  if (claimed instanceof Error) throw claimed;
}
