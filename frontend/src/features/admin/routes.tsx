import type { ComponentType } from "react";
import type { RouteObject } from "react-router";

/**
 * Super Admin area routes (/admin/...). Every page is lazy-loaded, so members never download
 * the admin screens and the main bundle stays small (step 6.0).
 */
function page(load: () => Promise<ComponentType>): Pick<RouteObject, "lazy"> {
  return { lazy: async () => ({ Component: await load() }) };
}

const dashboard = page(async () => (await import("./pages/AdminDashboardPage")).AdminDashboardPage);
const members = page(async () => (await import("./pages/AdminMembersPage")).AdminMembersPage);
const member = page(async () => (await import("./pages/AdminMemberPage")).AdminMemberPage);
const sections = page(
  async () => (await import("./pages/AdminVoiceSectionsPage")).AdminVoiceSectionsPage,
);
const cycles = page(async () => (await import("./pages/AdminCyclesPage")).AdminCyclesPage);
const cycle = page(async () => (await import("./pages/AdminCyclePage")).AdminCyclePage);
const criteria = page(async () => (await import("./pages/AdminCriteriaPage")).AdminCriteriaPage);
const forms = page(async () => (await import("./pages/AdminFormsPage")).AdminFormsPage);
const formEditor = page(
  async () => (await import("./pages/AdminFormEditorPage")).AdminFormEditorPage,
);
const evaluations = page(
  async () => (await import("./pages/AdminEvaluationsPage")).AdminEvaluationsPage,
);
const evaluation = page(
  async () => (await import("./pages/AdminEvaluationPage")).AdminEvaluationPage,
);
const moderation = page(
  async () => (await import("./pages/AdminModerationPage")).AdminModerationPage,
);
const audit = page(async () => (await import("./pages/AdminAuditPage")).AdminAuditPage);
const dataManagement = page(
  async () => (await import("./pages/AdminDataManagementPage")).AdminDataManagementPage,
);
const settings = page(async () => (await import("./pages/AdminSettingsPage")).AdminSettingsPage);

export const adminRoutes: RouteObject[] = [
  { index: true, ...dashboard },
  { path: "members", ...members },
  { path: "members/:publicId", ...member },
  { path: "voice-sections", ...sections },
  { path: "cycles", ...cycles },
  { path: "cycles/new", ...cycle },
  { path: "cycles/:publicId", ...cycle },
  { path: "criteria", ...criteria },
  { path: "forms", ...forms },
  { path: "forms/new", ...formEditor },
  { path: "forms/:publicId", ...formEditor },
  { path: "evaluations", ...evaluations },
  { path: "evaluations/:publicId", ...evaluation },
  { path: "moderation", ...moderation },
  { path: "audit", ...audit },
  { path: "data-management", ...dataManagement },
  { path: "settings", ...settings },
];
