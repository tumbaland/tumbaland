import React, { useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography
} from '@mui/material';
import { logger } from '@tumbaland/frontend-core';
import {
  API_KEY_SCOPES,
  CreatedApiKey,
  ApiKeyScope,
  PERSONAL_TENANT,
  apiKeyService
} from '../../services/apiKeyService';

export interface TenantOption {
  id: string;
  name: string;
}

interface CreateApiKeyDialogProps {
  open: boolean;
  onClose: () => void;
  /** Everything this person could grant a key, personal first. */
  tenantOptions: TenantOption[];
  onCreated: (key: CreatedApiKey) => void;
  onError: (text: string) => void;
}

/**
 * The form for a new key. It stays mounted while closed, so what was ticked
 * last time is still ticked; only the name is cleared after a key is made.
 */
export const CreateApiKeyDialog: React.FC<CreateApiKeyDialogProps> = ({
  open,
  onClose,
  tenantOptions,
  onCreated,
  onError
}) => {
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<ApiKeyScope[]>(['relationship:read', 'relationship:write']);
  // Both halves of a tenant grant. `tenants` is everything the key may reach;
  // `defaultTenant` is what it uses when a call does not say. The default is
  // always folded into the set on submit, so a key can never be created that
  // reaches nothing and then fails every call it makes.
  const [tenants, setTenants] = useState<string[]>([PERSONAL_TENANT]);
  const [defaultTenant, setDefaultTenant] = useState<string>(PERSONAL_TENANT);
  const [creating, setCreating] = useState(false);

  const toggleTenant = (id: string) =>
    setTenants((current) =>
      current.includes(id) ? current.filter((tenant) => tenant !== id) : [...current, id]
    );

  const toggleScope = (scope: ApiKeyScope) =>
    setScopes((current) =>
      current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope]
    );

  const handleCreate = async () => {
    try {
      setCreating(true);
      const created = await apiKeyService.create({
        name: name.trim(),
        scopes,
        tenants: [...new Set([defaultTenant, ...tenants])],
        defaultTenant
      });
      onCreated(created);
      setName('');
    } catch (error) {
      logger.error('Failed to create API key', { error });
      onError('Could not create the key.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>New API key</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          margin="dense"
          label="Name"
          placeholder="Claude Code"
          value={name}
          onChange={(event) => setName(event.target.value)}
          helperText="So you can tell your keys apart later."
        />

        <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5 }}>
          Acts on
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Tick everything this key may reach. Granting more than one means the assistant can work
          across them without a second key.
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', mt: 1 }}>
          {tenantOptions.map((option) => (
            <FormControlLabel
              key={option.id}
              control={
                <Checkbox
                  checked={tenants.includes(option.id) || defaultTenant === option.id}
                  // The default is always part of the grant, so its box is
                  // shown ticked and cannot be the one that empties the set.
                  disabled={defaultTenant === option.id}
                  onChange={() => toggleTenant(option.id)}
                />
              }
              label={option.name}
            />
          ))}
        </Box>

        <FormControl fullWidth margin="dense">
          <InputLabel id="api-key-default-tenant-label">Use by default</InputLabel>
          <Select
            labelId="api-key-default-tenant-label"
            label="Use by default"
            value={defaultTenant}
            onChange={(event) => setDefaultTenant(event.target.value)}
          >
            {tenantOptions.map((option) => (
              <MenuItem key={option.id} value={option.id}>
                {option.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5 }}>
          Permissions
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Grant only what the assistant needs. This cannot be changed afterwards.
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', mt: 1 }}>
          {API_KEY_SCOPES.map((scope) => (
            <FormControlLabel
              key={scope.value}
              control={
                <Checkbox
                  checked={scopes.includes(scope.value)}
                  onChange={() => toggleScope(scope.value)}
                />
              }
              label={scope.label}
            />
          ))}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={creating || name.trim().length === 0 || scopes.length === 0}
        >
          {creating ? 'Creating…' : 'Create key'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
