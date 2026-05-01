import * as React from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Checkbox,
  Divider,
  Paper,
  Stack,
  Typography,
  Autocomplete,
  Chip,
  ListItemText,
  TextField,
} from "@mui/material";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import { adminGetRolePermissions, adminUpdateRolePermissions } from "../services/authService";
import { useAuth } from "../context/authContext";

export default function RolePermissionsPage() {
  const { can } = useAuth();
  const isAdmin = can("admin.users");

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [offices, setOffices] = React.useState<Array<{ office_key: string; display_name: string }>>([]);
  const [permissionKeys, setPermissionKeys] = React.useState<string[]>([]);
  const [rolePerms, setRolePerms] = React.useState<Record<string, string[]>>({});
  const [savingRole, setSavingRole] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminGetRolePermissions();
      setOffices(res.offices ?? []);
      setPermissionKeys(res.permission_keys ?? []);
      const map: Record<string, string[]> = {};
      for (const rp of res.role_permissions ?? []) {
        map[String(rp.role_key)] = (rp.permissions ?? []).slice();
      }
      setRolePerms(map);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load role permissions.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!isAdmin) return;
    void refresh();
  }, [isAdmin, refresh]);

  if (!isAdmin) {
    return <Alert severity="error">Forbidden.</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} justifyContent="space-between">
          <Box>
            <Typography variant="h5">Role permissions</Typography>
            <Typography variant="body2" color="text.secondary">
              Configure which permissions each role grants. These changes affect all users whose office maps to that role.
            </Typography>
          </Box>
          <Button variant="outlined" onClick={() => refresh()} disabled={loading}>
            Refresh
          </Button>
        </Stack>
      </Paper>

      {error ? <Alert severity="error">{error}</Alert> : null}
      {loading ? <CircularProgress /> : null}

      {!loading ? (
        <Box sx={{ width: "100%", maxWidth: 1100, mx: "auto" }}>
          <Stack spacing={2}>
          {offices.map((o) => {
            const roleKey = o.office_key;
            const value = rolePerms[roleKey] ?? [];
            return (
              <Paper key={roleKey} elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
                <Stack spacing={1.5}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} justifyContent="space-between">
                    <Box>
                      <Typography variant="h6">
                        {o.display_name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Key: <b>{roleKey}</b> • {value.length} permissions
                      </Typography>
                    </Box>
                    <Button
                      variant="contained"
                      startIcon={<SaveOutlinedIcon />}
                      disabled={savingRole === roleKey}
                      onClick={async () => {
                        setError(null);
                        setSavingRole(roleKey);
                        const res = await adminUpdateRolePermissions(roleKey, value);
                        setSavingRole(null);
                        if (!res.ok) {
                          setError(res.error);
                          return;
                        }
                        void refresh();
                      }}
                    >
                      Save
                    </Button>
                  </Stack>

                  <Divider />

                  <Autocomplete
                    multiple
                    options={permissionKeys}
                    value={value}
                    disableCloseOnSelect
                    onChange={(_, next) => setRolePerms((prev) => ({ ...prev, [roleKey]: next ?? [] }))}
                    renderOption={(props, option, { selected }) => (
                      <li {...props} key={option}>
                        <Checkbox checked={selected} sx={{ mr: 1 }} />
                        <ListItemText primary={option} />
                      </li>
                    )}
                    renderTags={(tagValue, getTagProps) =>
                      tagValue.slice(0, 6).map((option, index) => (
                        <Chip
                          {...getTagProps({ index })}
                          key={option}
                          label={option}
                          size="small"
                          sx={{ maxWidth: 320 }}
                        />
                      ))
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Permissions"
                        placeholder="Search permissions…"
                        helperText="Type to search; select multiple. (Tags are capped; full list is saved.)"
                      />
                    )}
                    ListboxProps={{ style: { maxHeight: 360 } }}
                  />
                </Stack>
              </Paper>
            );
          })}
          </Stack>
        </Box>
      ) : null}
    </Stack>
  );
}


