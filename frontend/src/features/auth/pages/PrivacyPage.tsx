import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

import { DEFAULT_PRIVACY_NOTICE } from "@/components/PrivacyNotice";
import { usePublicSettings } from "@/lib/systemSettings";

/** What the software itself guarantees (Privacy Model), in plain words. */
const WHO_SEES = [
  [
    "Who wrote an evaluation",
    "Only the author and the Super Admin",
    "Never the member evaluated or other members",
  ],
  [
    "Comments and suggestions you receive",
    "You (without the author's name) and the Super Admin",
    "Other members",
  ],
  [
    "Averages of your ratings",
    "You, once enough members have rated you; the Super Admin",
    "Other members",
  ],
  ["Earlier versions of an evaluation", "The author and the Super Admin", "The member evaluated"],
  [
    "When an evaluation was written",
    "The Super Admin",
    "The member evaluated sees the date only, in a neutral order",
  ],
] as const;

/** SET-03: the choir's privacy notice, public (linked from every page footer). */
export function PrivacyPage() {
  const settings = usePublicSettings();
  return (
    <Stack spacing={3} sx={{ py: 4, maxWidth: 860 }}>
      <Typography variant="h4" component="h1">
        Privacy
      </Typography>
      {settings.isPending ? (
        <Skeleton variant="rounded" height={120} />
      ) : (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="h6" component="h2" gutterBottom>
            {settings.data?.choir_name || settings.data?.system_name || "Our choir"}
          </Typography>
          <Typography sx={{ whiteSpace: "pre-wrap" }}>
            {settings.data?.privacy_notice || DEFAULT_PRIVACY_NOTICE}
          </Typography>
        </Paper>
      )}
      <Typography variant="h6" component="h2">
        Who sees what
      </Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table aria-label="Who sees what">
          <TableHead>
            <TableRow>
              <TableCell>Information</TableCell>
              <TableCell>Who can see it</TableCell>
              <TableCell>Who can't</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {WHO_SEES.map(([what, who, not]) => (
              <TableRow key={what}>
                <TableCell component="th" scope="row">
                  {what}
                </TableCell>
                <TableCell>{who}</TableCell>
                <TableCell>{not}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Typography variant="body2" color="text.secondary">
        Every time the Super Admin views who wrote an evaluation, or exports data, it is recorded in
        an audit log that can't be changed. Hidden (moderated) comments are kept, not deleted.
      </Typography>
    </Stack>
  );
}
