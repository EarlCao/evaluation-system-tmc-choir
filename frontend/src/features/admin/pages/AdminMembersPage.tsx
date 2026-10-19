import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Link from "@mui/material/Link";
import MenuItem from "@mui/material/MenuItem";
import Pagination from "@mui/material/Pagination";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import { Link as RouterLink, useSearchParams } from "react-router";

import { ErrorState } from "@/components/ErrorState";
import { pageCount } from "@/lib/pagination";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

import { useAdminMembers } from "../queries";
import { STATUS_LABEL, type UserRole, type UserStatus } from "../types";

const STATUSES = Object.keys(STATUS_LABEL) as UserStatus[];

export function StatusChip({ status }: { status: UserStatus }) {
  const color = {
    PENDING: "warning",
    ACTIVE: "success",
    SUSPENDED: "error",
    DEACTIVATED: "default",
  } as const;
  return (
    <Chip size="small" variant="outlined" color={color[status]} label={STATUS_LABEL[status]} />
  );
}

/** ADM-04 / MEM-05: every account, searchable and filterable. */
export function AdminMembersPage() {
  const [params, setParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(params.get("search") ?? "");
  const search = useDebouncedValue(searchInput.trim());
  const status = (params.get("status") ?? "") as UserStatus | "";
  const role = (params.get("role") ?? "") as UserRole | "";
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const list = useAdminMembers({ search, status, role, page });

  const urlSearch = params.get("search") ?? "";
  useEffect(() => {
    if (search === urlSearch) return;
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (search) next.set("search", search);
        else next.delete("search");
        next.delete("page");
        return next;
      },
      { replace: true },
    );
  }, [search, urlSearch, setParams]);

  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: true });
  }

  return (
    <Stack spacing={3} sx={{ py: 4 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{ justifyContent: "space-between", gap: 2 }}
      >
        <Typography variant="h4" component="h1">
          Members
        </Typography>
        <Button component={RouterLink} to="/admin/voice-sections" variant="outlined">
          Manage voice sections
        </Button>
      </Stack>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <TextField
          label="Search name, username or email"
          type="search"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
          }}
          sx={{ flex: 2 }}
        />
        <TextField
          select
          label="Status"
          value={status}
          onChange={(e) => {
            update("status", e.target.value);
          }}
          sx={{ flex: 1, minWidth: 200 }}
        >
          <MenuItem value="">All statuses</MenuItem>
          {STATUSES.map((s) => (
            <MenuItem key={s} value={s}>
              {STATUS_LABEL[s]}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Role"
          value={role}
          onChange={(e) => {
            update("role", e.target.value);
          }}
          sx={{ flex: 1, minWidth: 160 }}
        >
          <MenuItem value="">All roles</MenuItem>
          <MenuItem value="MEMBER">Member</MenuItem>
          <MenuItem value="SUPER_ADMIN">Super Admin</MenuItem>
        </TextField>
      </Stack>

      {list.isError ? (
        <ErrorState message="We couldn't load the members." onRetry={() => void list.refetch()} />
      ) : list.isPending ? (
        <Skeleton variant="rounded" height={240} />
      ) : list.data.results.length === 0 ? (
        <Typography color="text.secondary">No accounts match these filters.</Typography>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" role="status">
            {list.data.count} {list.data.count === 1 ? "account" : "accounts"}
          </Typography>
          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{ opacity: list.isPlaceholderData ? 0.6 : 1 }}
          >
            <Table size="small" aria-label="Members">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Voice section</TableCell>
                  <TableCell>Officer position</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Joined</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {list.data.results.map((m) => (
                  <TableRow key={m.public_id} hover>
                    <TableCell>
                      <Link component={RouterLink} to={`/admin/members/${m.public_id}`}>
                        {m.first_name} {m.last_name}
                      </Link>
                    </TableCell>
                    <TableCell>{m.email}</TableCell>
                    <TableCell>{m.profile?.voice_section.name ?? "—"}</TableCell>
                    <TableCell>
                      {m.profile?.is_officer ? (
                        <Chip
                          size="small"
                          color="secondary"
                          label={m.profile.officer_position || "Officer"}
                        />
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{m.role === "SUPER_ADMIN" ? "Super Admin" : "Member"}</TableCell>
                    <TableCell>
                      <StatusChip status={m.status} />
                    </TableCell>
                    <TableCell>{new Date(m.date_joined).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {pageCount(list.data.count) > 1 ? (
            <Pagination
              count={pageCount(list.data.count)}
              page={page}
              onChange={(_, value) => {
                update("page", value > 1 ? String(value) : "");
              }}
              sx={{ alignSelf: "center" }}
            />
          ) : null}
        </>
      )}
    </Stack>
  );
}
