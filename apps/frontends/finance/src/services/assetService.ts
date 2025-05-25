import { AssetResponse } from '../types/Asset';

const API_BASE_URL = 'http://localhost:4001/api';

export const assetService = {
  async fetchAssets(): Promise<AssetResponse> {
    const response = await fetch(`${API_BASE_URL}/assets`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data: AssetResponse = await response.json();
    
    if (!data.success) {
      throw new Error('Failed to fetch assets');
    }
    
    return data;
  }
};
