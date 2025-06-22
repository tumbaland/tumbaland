import { ReactNode } from 'react';
import Container from "@mui/material/Container";
import Layout from './Layout';
import AppHeader from './AppHeader';

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <Layout>
      <AppHeader />
      <Container maxWidth="xl">
        {children}
      </Container>
    </Layout>
  );
};

export default AppLayout;
