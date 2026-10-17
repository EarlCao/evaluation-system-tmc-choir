import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

interface ComingSoonProps {
  title: string;
  step: string;
}

/** Placeholder for pages that later roadmap steps implement. */
export function ComingSoon({ title, step }: ComingSoonProps) {
  return (
    <Paper variant="outlined" sx={{ p: 4, my: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {title}
      </Typography>
      <Typography color="text.secondary">This page is built in roadmap step {step}.</Typography>
    </Paper>
  );
}
