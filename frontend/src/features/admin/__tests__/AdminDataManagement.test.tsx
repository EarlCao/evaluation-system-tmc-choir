import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { api, loggedInAs, superAdminUser } from "@/test/handlers";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

import type { AdminSettings, BackupItem } from "../systemTypes";

const settings: AdminSettings = {
  min_comment_prompts: 5,
  system_name: "Choir Member Evaluation System",
  choir_name: "Test Choir",
  choir_description: "",
  time_zone: "UTC",
  registration_mode: "APPROVAL",
  min_aggregate_group_size: 3,
  feedback_notification_debounce_minutes: 60,
  privacy_notice: "Your name is hidden from members.",
  retention_evaluations_days: 90,
  retention_revisions_days: 30,
  retention_audit_days: 730,
  updated_at: "2026-10-01T00:00:00Z",
  updated_by: "Ana Admin",
};

let backups: BackupItem[];
let createCalls: Array<{ note?: string }>;
let deleteCalls: string[];
let restoreCalls: Array<unknown>;
let cleanupCalls: number;

beforeEach(() => {
  backups = [
    {
      filename: "choir_eval_backup_20261019T100000Z.json.gz",
      created_at: "2026-10-19T10:00:00Z",
      created_by: "admin",
      size_bytes: 15360,
      sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      note: "Initial test backup",
    },
  ];
  createCalls = [];
  deleteCalls = [];
  restoreCalls = [];
  cleanupCalls = 0;

  server.use(
    loggedInAs(superAdminUser),
    http.get(api("/admin/settings/"), () => HttpResponse.json(settings)),
    http.get(api("/admin/backups/"), () => HttpResponse.json(backups)),
    http.post(api("/admin/backups/"), async ({ request }) => {
      const body = (await request.json()) as { note?: string };
      createCalls.push(body);
      const newBackup: BackupItem = {
        filename: "choir_eval_backup_20261019T110000Z.json.gz",
        created_at: "2026-10-19T11:00:00Z",
        created_by: "admin",
        size_bytes: 16000,
        sha256: "aabbcc112233",
        note: body.note ?? "",
      };
      backups.push(newBackup);
      return HttpResponse.json(newBackup, { status: 201 });
    }),
    http.delete(api("/admin/backups/:filename/"), ({ params }) => {
      const name = params.filename as string;
      deleteCalls.push(name);
      backups = backups.filter((b) => b.filename !== name);
      return new HttpResponse(null, { status: 204 });
    }),
    http.post(api("/admin/backups/restore/"), async ({ request }) => {
      const contentType = request.headers.get("content-type") ?? "";
      if (contentType.includes("multipart/form-data")) {
        const formData = await request.formData();
        restoreCalls.push({ file: formData.get("file") });
      } else {
        const body = await request.json();
        restoreCalls.push(body);
      }
      return HttpResponse.json({
        status: "success",
        message: "Database restored successfully.",
        records_count: 50,
      });
    }),
    http.post(api("/admin/data-management/cleanup/"), () => {
      cleanupCalls++;
      return HttpResponse.json({
        purged_evaluations: 2,
        purged_revisions: 5,
        purged_audit_logs: 10,
      });
    }),
  );
});

describe("Admin Data Management Page", () => {
  it("renders retention lifecycle info and existing backups table", async () => {
    renderRoute("/admin/data-management");

    expect(await screen.findByRole("heading", { name: "Data Management" })).toBeInTheDocument();
    expect(screen.getByText(/Evaluations retention:/i)).toBeInTheDocument();
    expect(screen.getByText(/90 days/i)).toBeInTheDocument();
    expect(screen.getByText("choir_eval_backup_20261019T100000Z.json.gz")).toBeInTheDocument();
    expect(screen.getByText("Initial test backup")).toBeInTheDocument();
    expect(screen.getByText("15 KB")).toBeInTheDocument();
  });

  it("creates a new database backup with custom note", async () => {
    const user = userEvent.setup();
    renderRoute("/admin/data-management");

    const createBtn = await screen.findByRole("button", { name: /create backup/i });
    await user.click(createBtn);

    const dialog = await screen.findByRole("dialog", { name: /create new database backup/i });
    expect(dialog).toBeInTheDocument();

    const noteInput = within(dialog).getByLabelText(/optional note or description/i);
    await user.type(noteInput, "Pre-deployment snapshot");

    const submitBtn = within(dialog).getByRole("button", { name: /generate backup/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Database backup created successfully.")).toBeInTheDocument();
    });
    expect(createCalls).toHaveLength(1);
    expect(createCalls[0]?.note).toBe("Pre-deployment snapshot");
    expect(screen.getByText("choir_eval_backup_20261019T110000Z.json.gz")).toBeInTheDocument();
  });

  it("restores database from an existing backup with confirmation", async () => {
    const user = userEvent.setup();
    renderRoute("/admin/data-management");

    const restoreBtn = await screen.findByRole("button", {
      name: /restore choir_eval_backup_20261019T100000Z\.json\.gz/i,
    });
    await user.click(restoreBtn);

    const dialog = await screen.findByRole("dialog", { name: /restore database from backup/i });
    expect(dialog).toBeInTheDocument();

    const confirmCheckbox = within(dialog).getByRole("checkbox");
    const confirmBtn = within(dialog).getByRole("button", { name: /confirm & restore/i });
    expect(confirmBtn).toBeDisabled();

    await user.click(confirmCheckbox);
    expect(confirmBtn).toBeEnabled();

    await user.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText("Database restored successfully.")).toBeInTheDocument();
    });
    expect(restoreCalls).toHaveLength(1);
  });

  it("deletes a backup with confirmation dialog", async () => {
    const user = userEvent.setup();
    renderRoute("/admin/data-management");

    const deleteBtn = await screen.findByRole("button", {
      name: /delete choir_eval_backup_20261019T100000Z\.json\.gz/i,
    });
    await user.click(deleteBtn);

    const dialog = await screen.findByRole("dialog", { name: /delete backup\?/i });
    expect(dialog).toBeInTheDocument();

    const confirmDelete = within(dialog).getByRole("button", { name: "Delete" });
    await user.click(confirmDelete);

    await waitFor(() => {
      expect(
        screen.getByText(
          /Backup choir_eval_backup_20261019T100000Z\.json\.gz deleted successfully\./i,
        ),
      ).toBeInTheDocument();
    });
    expect(deleteCalls).toEqual(["choir_eval_backup_20261019T100000Z.json.gz"]);
  });

  it("executes manual data retention cleanup with confirmation", async () => {
    const user = userEvent.setup();
    renderRoute("/admin/data-management");

    const cleanupBtn = await screen.findByRole("button", { name: /run retention cleanup now/i });
    await user.click(cleanupBtn);

    const dialog = await screen.findByRole("dialog", { name: /run retention cleanup\?/i });
    expect(dialog).toBeInTheDocument();

    const executeBtn = within(dialog).getByRole("button", { name: /execute cleanup/i });
    await user.click(executeBtn);

    await waitFor(() => {
      expect(
        screen.getByText(
          /Retention cleanup complete: purged 2 evaluations, 5 revisions, and 10 audit logs\./i,
        ),
      ).toBeInTheDocument();
    });
    expect(cleanupCalls).toBe(1);
  });
});
