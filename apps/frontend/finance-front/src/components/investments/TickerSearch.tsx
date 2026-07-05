import React, { useState } from 'react';
import { Box, TextField, Button, List, ListItemButton, ListItemText, Typography, CircularProgress } from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { searchTickers, TickerSearchResult } from '../../services/trackedTickerService';

interface TickerSearchProps {
  onSelect: (result: TickerSearchResult) => void;
}

/** Symbol lookup via Alpha Vantage (1 API call per search — free plan is 25/day). */
const TickerSearch: React.FC<TickerSearchProps> = ({ onSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TickerSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (query.trim().length < 2) return;
    setLoading(true);
    setError(null);
    try {
      setResults(await searchTickers(query.trim()));
    } catch {
      setError('Search failed — Alpha Vantage rate limit may be exhausted');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Search symbol or name (e.g. Vanguard S&P 500)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearch(); } }}
        />
        <Button onClick={handleSearch} startIcon={loading ? <CircularProgress size={16} /> : <SearchIcon />} disabled={loading}>
          Search
        </Button>
      </Box>
      {error && <Typography variant="caption" color="error">{error}</Typography>}
      {results.length > 0 && (
        <List dense sx={{ maxHeight: 200, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1, mt: 1 }}>
          {results.map((r) => (
            <ListItemButton key={r.symbol} onClick={() => { onSelect(r); setResults([]); setQuery(''); }}>
              <ListItemText primary={`${r.symbol} — ${r.name}`} secondary={`${r.type} · ${r.region} · ${r.currency}`} />
            </ListItemButton>
          ))}
        </List>
      )}
    </Box>
  );
};

export default TickerSearch;
