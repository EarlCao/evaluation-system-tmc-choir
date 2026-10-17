import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { exportUrl, type FileType, type ReportKind } from "@/lib/exports";

const LABEL: Record<FileType, string> = { csv: "CSV", xlsx: "Excel", pdf: "PDF" };

/** ADM-07: download links. Each download is written to the audit log. */
export function ExportButtons({
  report,
  filters = {},
  types = ["csv", "xlsx", "pdf"],
  identities = false,
}: {
  report: ReportKind;
  filters?: object;
  types?: FileType[];
  identities?: boolean;
}) {
  return (
    <Stack spacing={0.5}>
      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", alignItems: "center" }}>
        <Typography variant="body2" color="text.secondary">
          Export:
        </Typography>
        {types.map((type) => (
          <Button
            key={type}
            size="small"
            variant="outlined"
            href={exportUrl(report, type, filters)}
            download
            aria-label={`Export as ${LABEL[type]}`}
          >
            {LABEL[type]}
          </Button>
        ))}
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {identities
          ? "This export shows member names. It is recorded in the audit log; keep it confidential."
          : "Exports are recorded in the audit log."}
      </Typography>
    </Stack>
  );
}
