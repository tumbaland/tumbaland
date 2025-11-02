import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Card,
  CardContent,
  CardMedia,
  Chip
} from '@mui/material';
import { CloudUpload as CloudUploadIcon, ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon } from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { getAnalysisById, updateAnalysis } from '../services/analysisService';
import { getImagesByDataset, DatasetImage } from '../services/datasetImageService';
import FileUpload from '../components/FileUpload';

const DatasetDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadingJson, setUploadingJson] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [jsonSuccess, setJsonSuccess] = useState<string | null>(null);
  const [jsonExpanded, setJsonExpanded] = useState(false);

  const { data: analysis, isLoading, error } = useQuery({
    queryKey: ['analysis', id],
    queryFn: () => getAnalysisById(id!),
    enabled: Boolean(id)
  });

  const { data: imagesData, isLoading: imagesLoading } = useQuery({
    queryKey: ['datasetImages', id],
    queryFn: () => getImagesByDataset(id!, 1, 50),
    enabled: Boolean(id)
  });

  const images = imagesData?.data?.images || [];

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleUploadComplete = () => {
    // Invalidate and refetch images
    queryClient.invalidateQueries({ queryKey: ['datasetImages', id] });
  };

  const handleJsonFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleJsonFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.name.endsWith('.json')) {
      setJsonError('Please select a JSON file');
      return;
    }

    try {
      setUploadingJson(true);
      setJsonError(null);
      setJsonSuccess(null);

      // Read file content
      const content = await file.text();
      const jsonData = JSON.parse(content);

      // Update the analysis with the JSON data
      await updateAnalysis(id!, {
        dataset: analysis!.dataset,
        data: jsonData
      });

      setJsonSuccess('JSON data uploaded successfully!');
      
      // Refresh the analysis data
      queryClient.invalidateQueries({ queryKey: ['analysis', id] });

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : 'Failed to upload JSON data');
    } finally {
      setUploadingJson(false);
    }
  };

  if (isLoading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading dataset analysis...
        </Typography>
      </Container>
    );
  }

  if (error || !analysis) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error">
          Failed to load dataset analysis: {error instanceof Error ? error.message : 'Analysis not found'}
        </Alert>
        <Box sx={{ mt: 2 }}>
          <Button variant="contained" onClick={() => navigate('/analysis')}>
            Back to Analyses
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ mb: 1 }}>
            Dataset Analysis: {analysis.dataset}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Created: {new Date(analysis.createdAt).toLocaleString()}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            onClick={() => navigate('/analysis')}
          >
            Back to Analyses
          </Button>
        </Box>
      </Box>

      {/* Tabs */}
      <Paper sx={{ mb: 4 }}>
        <Tabs value={activeTab} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Dataset Description" />
          <Tab label="Example Images" />
        </Tabs>

        {/* Tab Panels */}
        <Box sx={{ p: 3 }}>
          {activeTab === 0 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                  <Typography variant="h6">
                    Dataset Analysis Data
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Upload JSON analysis data for this dataset.
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={jsonExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    onClick={() => setJsonExpanded(!jsonExpanded)}
                  >
                    {jsonExpanded ? 'Collapse' : 'Expand'}
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={uploadingJson ? <CircularProgress size={20} color="inherit" /> : <CloudUploadIcon />}
                    onClick={handleJsonFileClick}
                    disabled={uploadingJson}
                  >
                    {uploadingJson ? 'Uploading...' : 'Upload JSON'}
                  </Button>
                </Box>
              </Box>

              {/* JSON File Input (hidden) */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleJsonFileChange}
                style={{ display: 'none' }}
              />

              {/* JSON Messages */}
              {jsonError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {jsonError}
                </Alert>
              )}

              {jsonSuccess && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  {jsonSuccess}
                </Alert>
              )}

              <Paper sx={{ 
                p: 2, 
                backgroundColor: '#f5f5f5', 
                maxHeight: jsonExpanded ? 'none' : '70vh', 
                overflow: jsonExpanded ? 'visible' : 'auto',
                transition: 'max-height 0.3s ease-in-out'
              }}>
                <pre style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
                  {JSON.stringify(analysis.data || (() => {
                    // Handle legacy data structure where JSON is at top level
                    const { _id, createdAt, updatedAt, ...jsonData } = analysis as any;
                    return jsonData;
                  })(), null, 2)}
                </pre>
              </Paper>
            </Box>
          )}

          {activeTab === 1 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                  <Typography variant="h6">
                    Example Images ({images.length})
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Sample images from the dataset analysis.
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  startIcon={<CloudUploadIcon />}
                  onClick={() => setShowUploadDialog(true)}
                >
                  Upload Images
                </Button>
              </Box>

              {imagesLoading ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <CircularProgress />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    Loading images...
                  </Typography>
                </Box>
              ) : images.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 8 }}>
                  <Typography variant="h6" color="text.secondary">
                    No images available
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Images will be displayed here once uploaded to the dataset.
                  </Typography>
                </Box>
              ) : (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'repeat(2, 1fr)',
                      md: 'repeat(3, 1fr)',
                      lg: 'repeat(4, 1fr)'
                    },
                    gap: 2
                  }}
                >
                  {images.map((image: DatasetImage) => (
                    <Card key={image._id} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <CardMedia
                        component="img"
                        height="200"
                        image={image.thumbnailSignedUrl || image.signedUrl}
                        alt={image.title || image.originalName}
                        sx={{ objectFit: 'cover' }}
                      />
                      <CardContent sx={{ flexGrow: 1 }}>
                        <Typography variant="subtitle2" noWrap>
                          {image.title || image.originalName}
                        </Typography>
                        {image.description && (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {image.description}
                          </Typography>
                        )}
                        <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {image.tags.slice(0, 2).map((tag, index) => (
                            <Chip key={index} label={tag} size="small" variant="outlined" />
                          ))}
                          {image.tags.length > 2 && (
                            <Chip label={`+${image.tags.length - 2}`} size="small" variant="outlined" />
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Paper>

      {/* Upload Dialog */}
      <FileUpload
        datasetId={id!}
        open={showUploadDialog}
        onClose={() => setShowUploadDialog(false)}
        onUploadComplete={handleUploadComplete}
      />
    </Container>
  );
};

export default DatasetDetailPage;