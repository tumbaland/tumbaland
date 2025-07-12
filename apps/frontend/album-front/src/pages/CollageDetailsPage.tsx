import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, CircularProgress, Typography, Paper } from '@mui/material';
import CollageLayout from '../components/collage/CollageLayout';

import { Collage } from '../types/collage';
import { useCollage } from '../hooks/useCollage';

const CollageDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { getCollage } = useCollage();
  const [collage, setCollage] = useState<Collage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getCollage(id)
      .then(setCollage)
      .catch(() => setError('Failed to load collage'))
      .finally(() => setLoading(false));
  }, [id, getCollage]);

  return (
    <CollageLayout>
      <Box sx={{ p: 4, width: '100%', maxWidth: 900, mx: 'auto' }}>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="40vh">
            <CircularProgress />
          </Box>
        ) : error ? (
          <Typography color="error">{error}</Typography>
        ) : collage ? (
          <Paper sx={{ p: 3, bgcolor: '#333', color: '#fff' }}>
            <Typography variant="h4" gutterBottom>{collage.title}</Typography>
            <Typography variant="subtitle1" gutterBottom>{collage.config?.title?.subtitle}</Typography>
            <Typography variant="body2" gutterBottom>Theme: {collage.config?.theme}</Typography>
            <Typography variant="body2" gutterBottom>Created: {new Date(collage.createdAt).toLocaleString()}</Typography>
            <Typography variant="body2" gutterBottom>Album ID: {collage.albumId}</Typography>
            {/* Add more collage details or a preview here */}
          </Paper>
        ) : (
          <Typography>No collage found.</Typography>
        )}
      </Box>
    </CollageLayout>
  );
};

export default CollageDetailsPage;
