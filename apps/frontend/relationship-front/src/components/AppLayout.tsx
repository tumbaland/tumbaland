import { ReactNode } from 'react';
import Container from "@mui/material/Container";
import Layout from './Layout';
import AuthHeader from './AuthHeader';
import Navigation from './Navigation';

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <Layout>
      <AuthHeader title="Relationships" />
      <Container maxWidth="xl">
        <Navigation />
        {children}
      </Container>
    </Layout>
  );
};

export default AppLayout;
