import React, { useRef, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Typography,
  Container,
  Tabs,
  Tab
} from '@mui/material';
import { uploadAnalysis } from '../services/analysisService';
import AnalysisTable from '../components/AnalysisTable';
import DatasetComparisonPage from './DatasetComparisonPage';

export const AnalysisPage: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [tabValue, setTabValue] = useState(0);

  const handleFileClick = () => {
    fileInputRef.current?.click();
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

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box>
        <Card>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs
              value={tabValue}
              onChange={(_, newValue) => setTabValue(newValue)}
              aria-label="analysis tabs"
            >
              <Tab label="Analyses" id="tab-0" aria-controls="panel-0" />
              <Tab label="Compare" id="tab-1" aria-controls="panel-1" />
            </Tabs>
          </Box>

          {/* Analyses Tab */}
          {tabValue === 0 && (
            <Box role="tabpanel" id="panel-0" aria-labelledby="tab-0">
              <CardContent sx={{ pt: 3 }}>
                <Box display="grid" gridTemplateColumns="1fr" gap={3}>
                  {/* Upload Section */}
                  <Card>
                    <CardContent>
                      <Typography variant="h5" sx={{ mb: 2 }}>
                        Upload Dataset Analysis
                      </Typography>
                      <Typography color="textSecondary" sx={{ mb: 2 }}>
                        Upload multiple Waymo or ZOD analysis JSON files to view detailed statistics
                      </Typography>

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

                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".json"
                          multiple
                          onChange={handleFileChange}
                          style={{ display: 'none' }}
                        />
                        <Button
                          variant="contained"
                          onClick={handleFileClick}
                          disabled={uploading}
                          sx={{ minWidth: 200 }}
                        >
                          {uploading ? <CircularProgress size={24} /> : 'Select JSON Files'}
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>

                  {/* Analyses Table */}
                  <Card key={refreshKey}>
                    <CardContent>
                      <AnalysisTable />
                    </CardContent>
                  </Card>
                </Box>
              </CardContent>
            </Box>
          )}

          {/* Compare Tab */}
          {tabValue === 1 && (
            <Box role="tabpanel" id="panel-1" aria-labelledby="tab-1" sx={{ pt: 3 }}>
              <CardContent sx={{ p: 0 }}>
                <DatasetComparisonPage />
              </CardContent>
            </Box>
          )}
        </Card>
      </Box>
    </Container>
  );
};

export default AnalysisPage;
