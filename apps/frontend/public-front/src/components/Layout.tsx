import { AppBar, Toolbar, Typography, Container, Button, Box, Grid, Card, CardActionArea, CardMedia, CardContent } from '@mui/material';
import { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

const Layout = () => {
  const collageUrl = import.meta.env.VITE_COLLAGE_URL;
  const financeUrl = import.meta.env.VITE_FINANCE_URL;
  const relationshipUrl = import.meta.env.VITE_RELATIONSHIP_URL;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundImage: 'url(/background.jpg)', // Corrected to load from the public folder
        backgroundRepeat: 'no-repeat', // Ensure the image does not repeat
        backgroundAttachment: 'fixed', // Make the background fixed for a better effect
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        color: 'white',
      }}
    >
      <Container
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <Typography variant="h2" gutterBottom>
          Welcome to Tumbaland
        </Typography>
        <Grid container spacing={4} sx={{ mt: 4, justifyContent: 'center' }}>
          <Card sx={{ maxWidth: 300, mx: 2, position: 'relative' }}>
            <CardActionArea href={collageUrl}>
              <CardMedia
                component="img"
                height="300"
                image="/album.png"
                alt="Collage Service"
                sx={{ position: 'relative' }}
              />
              <CardContent
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  color: 'white',
                  width: '100%',
                  textAlign: 'center',
                }}
              >
                <Typography variant="h6">
                  Create stunning collages
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
          <Card sx={{ maxWidth: 300, mx: 2, position: 'relative' }}>
            <CardActionArea href={financeUrl}>
              <CardMedia
                component="img"
                height="300"
                image="/finance.png"
                alt="Finance Service"
                sx={{ position: 'relative' }}
              />
              <CardContent
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  color: 'white',
                  width: '100%',
                  textAlign: 'center',
                }}
              >
                <Typography variant="h6">
                  Manage finances
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
          <Card sx={{ maxWidth: 300, mx: 2, position: 'relative' }}>
            <CardActionArea href={relationshipUrl}>
              <CardMedia
                component="img"
                height="300"
                image="/relationship.png"
                alt="Relationship Service"
                sx={{ position: 'relative' }}
              />
              <CardContent
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  color: 'white',
                  width: '100%',
                  textAlign: 'center',
                }}
              >
                <Typography variant="h6">
                  Strengthen relationships
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
      </Container>
      <Box
        component="footer"
        sx={{ py: 2, textAlign: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      >
        <Typography variant="body2" color="textSecondary">
          2025
        </Typography>
      </Box>
    </Box>
  );
};

export default Layout;
