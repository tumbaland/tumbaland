import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import { Header } from "@tumbaland/components/header";

function App() {
  const handleMenuClick = () => {
    console.log('Menu clicked');
  };

  const handleAccountClick = () => {
    console.log('Account clicked');
  };

  const menuItems = [
    { 
      label: 'Dashboard', 
      onClick: () => console.log('Dashboard clicked') 
    },
    { 
      label: 'Activities', 
      onClick: () => console.log('Activities clicked') 
    },
    { 
      label: 'Contacts', 
      onClick: () => console.log('Contacts clicked') 
    }
  ];

  return (
    <>
      <Header 
        title="Finance App"
        menuItems={menuItems}
        onMenuClick={handleMenuClick}
        onAccountClick={handleAccountClick}
      />
      <Container maxWidth="lg">
        <Box sx={{ my: 4 }}>
          <Typography variant="h4" component="h1" sx={{ mb: 2 }}>
            Welcome to Finance App
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your finances effectively.
          </Typography>
        </Box>
      </Container>
    </>
  );
}

export default App;
