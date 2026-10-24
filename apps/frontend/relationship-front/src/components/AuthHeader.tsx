import React from 'react';
import { StandaloneAuthHeader } from '@tumbaland/frontend-core';
import { authService } from '../services/authService';
import { navigationItems } from '../config/navigation';
import { useConfig } from '../config/ConfigProvider';

const AuthHeader: React.FC = () => {
  const config = useConfig();

  return (
    <StandaloneAuthHeader
      authService={authService}
      navigationItems={navigationItems}
      groupApiUrl={config.GROUP_API_URL}
      shellFrontUrl={config.SHELL_FRONT_URL}
    />
  );
};

export default AuthHeader;
