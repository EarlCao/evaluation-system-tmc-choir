import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Link } from "react-router";

import { ApiStatus } from "@/components/ApiStatus";

export function WelcomePage() {
  return (
    <Stack spacing={4} sx={{ py: { xs: 4, md: 8 } }}>
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 3, sm: 5, md: 6 },
          position: "relative",
          overflow: "hidden",
          background:
            "linear-gradient(135deg, rgba(55, 48, 163, 0.06) 0%, rgba(15, 118, 110, 0.06) 100%)",
        }}
      >
        <Stack spacing={3} sx={{ maxWidth: 760 }}>
          <Box>
            <Chip
              label="TMC Choral Excellence & Peer Growth"
              color="primary"
              size="small"
              sx={{ mb: 2, fontWeight: 700 }}
            />
            <Typography
              variant="h3"
              component="h1"
              sx={{
                fontWeight: 800,
                letterSpacing: "-0.02em",
                fontSize: { xs: "2rem", sm: "2.5rem", md: "3rem" },
              }}
            >
              TMC CHOIR EVALUATION SYSTEM
            </Typography>
          </Box>
          <Typography variant="h6" component="p" color="text.secondary" sx={{ fontWeight: 400 }}>
            A private, constructive way for choir members to give each other feedback. Your name is
            never shown to the members you evaluate.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ pt: 1 }}>
            <Button component={Link} to="/login" variant="contained" size="large">
              Log in
            </Button>
            <Button component={Link} to="/register" variant="outlined" size="large">
              Create an account
            </Button>
            <Button
              component={Link}
              to="/login?role=admin"
              variant="text"
              color="secondary"
              size="large"
            >
              Super Admin Sign In
            </Button>
          </Stack>
          <Box sx={{ pt: 1 }}>
            <ApiStatus />
          </Box>
        </Stack>
      </Paper>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="subtitle1" component="h2" gutterBottom sx={{ fontWeight: 700 }}>
                Confidential Peer Feedback
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Share honest, encouraging evaluations across vocal technique, musicality, and blend
                while keeping evaluator identities protected from peers.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="subtitle1" component="h2" gutterBottom sx={{ fontWeight: 700 }}>
                Section & Choir Harmony
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Structured evaluation periods tailored for Soprano, Alto, Tenor, and Bass sections
                with clear rubric criteria and progress tracking.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="subtitle1" component="h2" gutterBottom sx={{ fontWeight: 700 }}>
                Actionable Growth Insights
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Review aggregated ratings and moderated qualitative feedback after each evaluation
                period to support continuous vocal development.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
}

