import { useContext } from 'react';
import { ConfigContext } from '../config/ConfigProvider';

export function useConfig() {
  const config = useContext(ConfigContext);
  if (!config) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return config;
}
