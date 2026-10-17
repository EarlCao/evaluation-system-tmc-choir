import Link from "@mui/material/Link";

/** Keyboard users can jump straight to the page content (NFR-05). */
export function SkipLink() {
  return (
    <Link
      href="#main"
      sx={{
        position: "absolute",
        left: -9999,
        "&:focus": { left: 16, top: 16, zIndex: 2000, bgcolor: "background.paper", p: 1 },
      }}
    >
      Skip to content
    </Link>
  );
}
