import { ReactNode } from 'react';
import { AppLayout as SharedAppLayout } from '@tumbaland/frontend-core';
import AuthHeader from './AuthHeader';

/** Thin binding to the shared layout, kept so pages' import paths stay put. */
const AppLayout = ({ children }: { children: ReactNode }) => (
  <SharedAppLayout header={<AuthHeader />}>{children}</SharedAppLayout>
);

export default AppLayout;
