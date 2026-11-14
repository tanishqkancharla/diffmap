import { pages } from "./content.ts";

// Same public ingestion key as the existing CLI project; no new remote project.
const projectKey = "phc_wmzP7VyBQzTLwsSoGtyxNDvqHUDRpi7NofcTaYBW9pjv";
const endpoint = "https://us.i.posthog.com/i/v0/e/";
export type WebsiteEvent = "website_page_view" | "website_install_cta";
export type WebsitePayload = {
  api_key: string;
  event: WebsiteEvent;
  distinct_id: string;
  properties: {
    product: "product-docs";
    surface: "website";
    page: string;
    action?: "release_status";
    $process_person_profile: false;
    $geoip_disable: true;
  };
};

/** No SDK: only these two events and allowlisted properties can reach transport. */
export function createWebsiteTelemetry(input: {
  enabled: boolean;
  browser: Pick<
    Window,
    "location" | "navigator" | "localStorage" | "sessionStorage" | "crypto"
  >;
  transport?: (payload: WebsitePayload) => void;
}) {
  const browser = input.browser;
  const storageKey = "productdoc-website-analytics";
  let session: string | undefined;
  const blocked = () =>
    browser.navigator.doNotTrack === "1" ||
    (browser.navigator as Navigator & { globalPrivacyControl?: boolean })
      .globalPrivacyControl === true ||
    browser.navigator.webdriver ||
    /bot|crawler|spider|headless/i.test(browser.navigator.userAgent);
  const consented = () => {
    try {
      return browser.localStorage.getItem(storageKey) === "allow";
    } catch {
      return false;
    }
  };
  const capture = (event: WebsiteEvent) => {
    if (!input.enabled || blocked() || !consented()) return;
    const page = browser.location.pathname.replace(/\/$/, "") || "/";
    if (!pages.some((publicPage) => publicPage.path === page)) return;
    try {
      session ??=
        browser.sessionStorage.getItem("productdoc-website-session") ??
        `website:${browser.crypto.randomUUID()}`;
      browser.sessionStorage.setItem("productdoc-website-session", session);
      const payload: WebsitePayload = {
        api_key: projectKey,
        event,
        distinct_id: session,
        properties: {
          product: "product-docs",
          surface: "website",
          page,
          ...(event === "website_install_cta"
            ? { action: "release_status" as const }
            : {}),
          $process_person_profile: false,
          $geoip_disable: true,
        },
      };
      if (input.transport) input.transport(payload);
      else
        void fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          credentials: "omit",
          referrerPolicy: "no-referrer",
          keepalive: true,
        }).catch(() => undefined);
    } catch {
      /* Storage restrictions and analytics failures never block reading. */
    }
  };
  return {
    capture,
    consented,
    setConsent(allow: boolean) {
      try {
        browser.localStorage.setItem(storageKey, allow ? "allow" : "deny");
        if (!allow) {
          browser.sessionStorage.removeItem("productdoc-website-session");
          session = undefined;
        }
      } catch {
        /* Without storage there is no consent, so collection stays off. */
      }
    },
  };
}

/** Source-controlled rollout gate. No query string or stored preference enables it. */
export const websiteAnalyticsEnabled = false;
