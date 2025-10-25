import React, { useRef, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Alert,
  Typography,
  Container,
  IconButton
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { CloudUpload as CloudUploadIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { uploadAnalysis } from '../services/analysisService';
import AnalysisTable from '../components/AnalysisTable';

export const AnalysisPage: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedAnalysisIds, setSelectedAnalysisIds] = useState<Set<string>>(new Set());

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const errors: string[] = [];
    let successCount = 0;

    try {
      setUploading(true);
      setError(null);
      setSuccess(null);

      // Process each file
      for (const file of fileArray) {
        try {
          // Validate file is JSON
          if (!file.name.endsWith('.json')) {
            errors.push(`${file.name}: Not a JSON file`);
            continue;
          }

          // Read file content
          const content = await file.text();
          const data = JSON.parse(content);

          // Upload to API
          await uploadAnalysis(data);
          successCount++;
        } catch (fileErr) {
          errors.push(`${file.name}: ${fileErr instanceof Error ? fileErr.message : 'Upload failed'}`);
        }
      }

      if (successCount > 0) {
        setSuccess(`${successCount} analysis file(s) uploaded successfully!`);
        setRefreshKey((prev) => prev + 1);
      }

      if (errors.length > 0) {
        setError(errors.join('\n'));
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload analysis files');
    } finally {
      setUploading(false);
    }
  };

  // Handle checkbox change
  const handleSelectAnalysis = (analysisId: string) => {
    const newSelected = new Set(selectedAnalysisIds);
    if (newSelected.has(analysisId)) {
      newSelected.delete(analysisId);
    } else {
      newSelected.add(analysisId);
    }
    setSelectedAnalysisIds(newSelected);
  };

  // Handle select all
  const handleSelectAll = (allIds: string[]) => {
    setSelectedAnalysisIds(new Set(allIds));
  };

  // Handle compare selected
  const handleCompareSelected = () => {
    // Navigate to comparison page with selected analysis IDs
    const selectedIds = Array.from(selectedAnalysisIds);
    if (selectedIds.length > 1) {
      navigate(`/analysis/compare?ids=${selectedIds.join(',')}`);
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" component="h1">
          Dataset Analysis
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : <CloudUploadIcon />}
            onClick={handleFileClick}
            disabled={uploading}
          >
            {uploading ? 'Uploading...' : 'Upload Analyses'}
          </Button>
          <IconButton onClick={handleRefresh} disabled={uploading}>
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
        Upload and analyze dataset statistics for Waymo and ZOD datasets. Compare multiple datasets to understand data distribution and quality.
      </Typography>

      {/* File Input (hidden) */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        multiple
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* Messages */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      {/* Analyses Table */}
      <Box key={refreshKey}>
        <AnalysisTable
          selectedAnalysisIds={selectedAnalysisIds}
          onSelectAnalysis={handleSelectAnalysis}
          onSelectAll={handleSelectAll}
          onCompareSelected={handleCompareSelected}
        />
      </Box>
    </Container>
  );
};

export default AnalysisPage;
