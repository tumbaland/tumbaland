import { ReactNode } from 'react';
import Container from "@mui/material/Container";
import Layout from './Layout';

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <Layout>
      <Container maxWidth="xl">
        {children}
      </Container>
    </Layout>
  );
};

export default AppLayout;
