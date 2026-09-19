import { ReactNode } from 'react';
import { AppLayout as SharedAppLayout } from '@tumbaland/components';

/**
 * Sign-in is one centred card, so it caps narrower than the modules do and
 * keeps its own full-height column for the centring.
 */
const AppLayout = ({ children }: { children: ReactNode }) => (
  <SharedAppLayout maxWidth="sm">{children}</SharedAppLayout>
);

export default AppLayout;
