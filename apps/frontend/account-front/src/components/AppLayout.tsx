import { ReactNode } from 'react';
import { AppLayout as SharedAppLayout } from '@tumbaland/frontend-core';

/** Thin binding to the shared layout, kept so pages' import paths stay put. */
const AppLayout = ({ children }: { children: ReactNode }) => <SharedAppLayout>{children}</SharedAppLayout>;

export default AppLayout;
