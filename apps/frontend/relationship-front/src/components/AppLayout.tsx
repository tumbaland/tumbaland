import { ReactNode } from 'react';
import Container from "@mui/material/Container";
import Layout from './Layout';
import AuthHeader from './AuthHeader';

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <Layout>
      <AuthHeader title="Relationships" />
      <Container maxWidth="xl">
        {children}
      </Container>
    </Layout>
  );
};

export default AppLayout;
