"""AUD-03: receipts retained by the user-approved manual-deletion exception."""

DELETION_EVENTS = ("audit.entry.deleted", "audit.logs.cleared")
CLEAR_CONFIRMATION = "DELETE ALL LOGS"
