import "./site.css";
import {
  createWebsiteTelemetry,
  websiteAnalyticsEnabled,
} from "./telemetry.ts";

const demo = document.getElementById("reader-demo");
if (demo) {
  // Progressive enhancement: the whole page and links already exist without JS.
  void import("./demo.tsx").then(({ mountDemo }) => mountDemo(demo));
}

// The preview build drops the whole integration, not just its network calls.
if (websiteAnalyticsEnabled) {
  const telemetry = createWebsiteTelemetry({ enabled: true, browser: window });
  telemetry.capture("website_page_view");
  document.querySelectorAll("[data-install-cta]").forEach((link) => {
    link.addEventListener("click", () =>
      telemetry.capture("website_install_cta"),
    );
  });
  const controls = document.querySelector<HTMLElement>(
    "[data-analytics-controls]",
  );
  if (controls) {
    controls.hidden = false;
    const status = controls.querySelector<HTMLElement>("[role=status]");
    const update = () => {
      if (status)
        status.textContent = telemetry.consented()
          ? "Website analytics allowed. You can opt out at any time."
          : "Website analytics off.";
    };
    controls.querySelector("[data-allow]")?.addEventListener("click", () => {
      telemetry.setConsent(true);
      update();
      telemetry.capture("website_page_view");
    });
    controls.querySelector("[data-deny]")?.addEventListener("click", () => {
      telemetry.setConsent(false);
      update();
    });
    update();
  }
}
