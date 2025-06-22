import React from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  ImageList,
  ImageListItem,
  ImageListItemBar,
  Button,
  Card,
  CardContent
} from '@mui/material';
import { Add, PhotoLibrary, Favorite } from '@mui/icons-material';

const PhotoAlbum: React.FC = () => {
  // Mock photo data
  const photos = [
    {
      id: 1,
      src: 'https://via.placeholder.com/300x200/FFB6C1/000000?text=Cooking+Date',
      title: 'Cooking Together',
      date: '2025-06-20',
      activity: 'Making homemade pasta'
    },
    {
      id: 2,
      src: 'https://via.placeholder.com/300x200/87CEEB/000000?text=Movie+Night',
      title: 'Movie Night',
      date: '2025-06-19',
      activity: 'Cozy evening watching movies'
    },
    {
      id: 3,
      src: 'https://via.placeholder.com/300x200/98FB98/000000?text=Gaming+Fun',
      title: 'Gaming Session',
      date: '2025-06-18',
      activity: 'Playing It Takes Two'
    },
    {
      id: 4,
      src: 'https://via.placeholder.com/300x200/F0E68C/000000?text=Beach+Trip',
      title: 'Beach Weekend',
      date: '2025-06-15',
      activity: 'Weekend getaway'
    },
    {
      id: 5,
      src: 'https://via.placeholder.com/300x200/DDA0DD/000000?text=Sunset+Walk',
      title: 'Evening Walk',
      date: '2025-06-14',
      activity: 'Romantic sunset stroll'
    },
    {
      id: 6,
      src: 'https://via.placeholder.com/300x200/F4A460/000000?text=Coffee+Date',
      title: 'Coffee Date',
      date: '2025-06-12',
      activity: 'Morning coffee and pastries'
    }
  ];

  const albumStats = {
    totalPhotos: 127,
    thisMonth: 23,
    favoriteMemories: 15
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Photo Album
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          sx={{ bgcolor: 'primary.main' }}
        >
          Add Photos
        </Button>
      </Box>

      {/* Album Stats */}
      <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap' }}>
        <Card sx={{ minWidth: 200 }}>
          <CardContent sx={{ textAlign: 'center' }}>
            <PhotoLibrary sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
            <Typography variant="h5">{albumStats.totalPhotos}</Typography>
            <Typography variant="body2" color="text.secondary">
              Total Photos
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ minWidth: 200 }}>
          <CardContent sx={{ textAlign: 'center' }}>
            <Add sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
            <Typography variant="h5">{albumStats.thisMonth}</Typography>
            <Typography variant="body2" color="text.secondary">
              This Month
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ minWidth: 200 }}>
          <CardContent sx={{ textAlign: 'center' }}>
            <Favorite sx={{ fontSize: 40, color: 'error.main', mb: 1 }} />
            <Typography variant="h5">{albumStats.favoriteMemories}</Typography>
            <Typography variant="body2" color="text.secondary">
              Favorite Memories
            </Typography>
          </CardContent>
        </Card>
      </Box>
      
      {/* Photo Grid */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Recent Memories
        </Typography>
        <ImageList variant="masonry" cols={3} gap={8}>
          {photos.map((photo) => (
            <ImageListItem key={photo.id}>
              <img
                src={photo.src}
                alt={photo.title}
                loading="lazy"
                style={{ borderRadius: 8 }}
              />
              <ImageListItemBar
                title={photo.title}
                subtitle={`${photo.date} - ${photo.activity}`}
                sx={{
                  borderRadius: '0 0 8px 8px',
                  background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 70%, rgba(0,0,0,0) 100%)'
                }}
              />
            </ImageListItem>
          ))}
        </ImageList>
      </Paper>
    </Box>
  );
};

export default PhotoAlbum;
