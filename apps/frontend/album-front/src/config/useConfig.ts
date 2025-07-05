import { useContext } from 'react';
import { ConfigContext } from '../App';
import { AppConfig } from './ConfigProvider';

export function useConfig(): AppConfig {
  const config = useContext(ConfigContext);
  
  if (!config || !config.ALBUM_API_URL) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  
  return config;
}
