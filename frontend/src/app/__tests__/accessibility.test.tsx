import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { api, loggedInAs, memberUser, superAdminUser } from "@/test/handlers";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

/**
 * Step 6.2: accessibility checks (NFR-05: keyboard navigation, labels on every input,
 * landmarks, heading hierarchy and skip-to-content target).
 */
function assertAccessibleControls(container: HTMLElement) {
  const inputs = container.querySelectorAll<HTMLElement>(
    'input:not([type="hidden"]), textarea, [role="combobox"]',
  );
  for (const el of inputs) {
    // MUI Select uses a hidden native input next to a labelled combobox button
    if (el.classList.contains("MuiSelect-nativeInput")) continue;
    const id = el.getAttribute("id");
    const hasForLabel = id
      ? Boolean(container.querySelector(`label[for="${CSS.escape(id)}"]`))
      : false;
    const hasWrappingLabel = Boolean(el.closest("label"));
    const hasAriaLabel = Boolean(
      el.getAttribute("aria-label") || el.getAttribute("aria-labelledby"),
    );
    expect(
      hasForLabel || hasWrappingLabel || hasAriaLabel,
      `Control <${el.tagName.toLowerCase()}> must have an associated label`,
    ).toBe(true);
  }

  for (const button of container.querySelectorAll<HTMLElement>('button, [role="button"]')) {
    const name =
      button.textContent.trim() ||
      button.getAttribute("aria-label") ||
      button.getAttribute("aria-labelledby");
    expect(Boolean(name), "Every button must have an accessible name").toBe(true);
  }
}

describe("Accessibility pass (NFR-05)", () => {
  it("provides a keyboard-focusable Skip to content link targeting #main", async () => {
    const user = userEvent.setup();
    renderRoute("/login");

    await screen.findByRole("heading", { name: /log in/i });
    (document.activeElement as HTMLElement | null)?.blur();
    await user.tab();

    const skip = screen.getByRole("link", { name: "Skip to content" });
    expect(skip).toHaveFocus();
    expect(skip).toHaveAttribute("href", "#main");

    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main");
    expect(main).toHaveAttribute("tabindex", "-1");
  });

  it("labels every form control and exposes a main heading on /login and /register", async () => {
    const loginView = renderRoute("/login");
    await screen.findByRole("heading", { level: 1, name: /log in/i });
    assertAccessibleControls(loginView.container);
    loginView.unmount();

    const registerView = renderRoute("/register");
    await screen.findByRole("heading", { level: 1, name: /create an account/i });
    assertAccessibleControls(registerView.container);
  });

  it("exposes landmarks and accessible controls in the member layout (/app and /app/members)", async () => {
    server.use(
      loggedInAs(memberUser),
      http.get(api("/members/"), () =>
        HttpResponse.json({ count: 0, next: null, previous: null, results: [] }),
      ),
    );
    const view = renderRoute("/app/members");
    await screen.findByRole("heading", { level: 1, name: /choir members/i });

    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("id", "main");
    assertAccessibleControls(view.container);
  });

  it("exposes landmarks and accessible navigation in the Super Admin layout (/admin)", async () => {
    server.use(
      loggedInAs(superAdminUser),
      http.get(api("/admin/reports/dashboard/"), () =>
        HttpResponse.json({
          members: { registered: 5, active: 4, pending: 1, suspended: 0, deactivated: 0 },
          evaluations_submitted: 3,
          needs_moderation: 0,
          cycles: { DRAFT: 0, OPEN: 1, CLOSED: 0, ARCHIVED: 0 },
          open_cycle: null,
        }),
      ),
    );
    const view = renderRoute("/admin");
    await screen.findByRole("navigation", { name: "Admin" });
    expect(screen.getByRole("main")).toHaveAttribute("id", "main");
    assertAccessibleControls(view.container);
  });
});
