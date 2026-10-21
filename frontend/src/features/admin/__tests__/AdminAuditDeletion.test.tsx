import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { api, loggedInAs, superAdminUser } from "@/test/handlers";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

import type { AuditDeleteInput, AuditEntry } from "../systemTypes";

const PASSWORD = "Audit-Test-Passphrase"; // gitleaks:allow (fake test password)
const entry: AuditEntry = {
  id: 7,
  occurred_at: "2026-10-21T00:00:00Z",
  event_type: "accounts.user.logged_in",
  actor: null,
  actor_role: "",
  target_type: "",
  target_id: "",
  before: null,
  after: null,
  metadata: {},
  ip_address: null,
  user_agent: "",
  request_id: "",
};
let rows: AuditEntry[];
let requests: { url: string; body: AuditDeleteInput }[];

beforeEach(() => {
  rows = [entry];
  requests = [];
  server.use(
    loggedInAs(superAdminUser),
    http.get(api("/admin/audit-logs/"), () =>
      HttpResponse.json({ count: rows.length, next: null, previous: null, results: rows }),
    ),
    http.get(api("/admin/audit-logs/event-types/"), () => HttpResponse.json([])),
    http.delete(api("/admin/audit-logs/:id/"), async ({ request }) => {
      requests.push({ url: request.url, body: (await request.json()) as AuditDeleteInput });
      rows = [{ ...entry, id: 8, event_type: "audit.entry.deleted" }];
      return HttpResponse.json({ deleted: 1 });
    }),
    http.delete(api("/admin/audit-logs/"), async ({ request }) => {
      requests.push({ url: request.url, body: (await request.json()) as AuditDeleteInput });
      rows = [{ ...entry, id: 9, event_type: "audit.logs.cleared" }];
      return HttpResponse.json({ deleted: 1 });
    }),
  );
});

async function fillConfirmation(dialog: HTMLElement) {
  const user = userEvent.setup({ delay: null });
  await user.type(within(dialog).getByLabelText(/reason for deletion/i), "Old test entries");
  await user.type(within(dialog).getByLabelText(/your password/i), PASSWORD);
  return user;
}

describe("Audit deletion (AUD-03 / ADR-022)", () => {
  it("requires password and reason, and sends nothing when cancelled", async () => {
    renderRoute("/admin/audit");
    await userEvent.click(await screen.findByRole("button", { name: "Delete entry 7" }));
    const dialog = screen.getByRole("dialog", { name: "Delete this audit entry?" });
    expect(within(dialog).getByRole("button", { name: "Delete entry" })).toBeDisabled();
    await fillConfirmation(dialog);
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(requests).toEqual([]);
    await userEvent.click(screen.getByRole("button", { name: "Delete entry 7" }));
    expect(screen.getByLabelText(/your password/i)).toHaveValue("");
    expect(screen.getByLabelText(/reason for deletion/i)).toHaveValue("");
  });

  it("deletes one entry and refreshes to the retained deletion receipt", async () => {
    renderRoute("/admin/audit");
    await userEvent.click(await screen.findByRole("button", { name: "Delete entry 7" }));
    const dialog = screen.getByRole("dialog", { name: "Delete this audit entry?" });
    const user = await fillConfirmation(dialog);
    await user.click(within(dialog).getByRole("button", { name: "Delete entry" }));
    expect(await screen.findByText(/1 audit entry deleted/i)).toBeVisible();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(requests).toHaveLength(1);
    expect(new URL(requests[0]!.url).pathname).toBe("/api/v1/admin/audit-logs/7/");
    expect(requests[0]!.body).toEqual({
      password: PASSWORD,
      reason: "Old test entries",
      confirmation: "",
    });
    expect(await screen.findByText("audit.entry.deleted")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Delete entry 8" })).not.toBeInTheDocument();
  });

  it("requires the exact bulk phrase and clears across filters without sending filter parameters", async () => {
    const { router } = renderRoute("/admin/audit?event_type=accounts.user.logged_in");
    await screen.findByRole("table", { name: "Audit log" });
    await userEvent.click(screen.getByRole("button", { name: "Clear all logs" }));
    const dialog = screen.getByRole("dialog", { name: "Clear all audit logs?" });
    expect(dialog).toHaveTextContent("including entries outside the current filters");
    const user = await fillConfirmation(dialog);
    const confirm = within(dialog).getByRole("button", { name: "Clear all logs" });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/type delete all logs/i), "DELETE ALL LOGS");
    await user.click(confirm);
    expect(await screen.findByText(/1 audit entry deleted/i)).toBeVisible();
    expect(requests).toHaveLength(1);
    expect(new URL(requests[0]!.url).search).toBe("");
    expect(requests[0]!.body.confirmation).toBe("DELETE ALL LOGS");
    await waitFor(() => {
      expect(router.state.location.search).toBe("");
    });
    expect(await screen.findByText("audit.logs.cleared")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Delete entry 9" })).not.toBeInTheDocument();
  });

  it("keeps the dialog open on failure, displays the error and discards the password", async () => {
    server.use(
      http.delete(api("/admin/audit-logs/:id/"), () =>
        HttpResponse.json(
          {
            error: {
              code: "validation_error",
              message: "Invalid confirmation.",
              fields: { password: ["Your password is incorrect."] },
            },
          },
          { status: 400 },
        ),
      ),
    );
    renderRoute("/admin/audit");
    await userEvent.click(await screen.findByRole("button", { name: "Delete entry 7" }));
    const dialog = screen.getByRole("dialog", { name: "Delete this audit entry?" });
    const user = await fillConfirmation(dialog);
    await user.click(within(dialog).getByRole("button", { name: "Delete entry" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Your password is incorrect.",
    );
    expect(within(dialog).getByLabelText(/your password/i)).toHaveValue("");
    expect(screen.queryByText(/audit entry deleted/i)).not.toBeInTheDocument();
  });
});
