import { useCallback } from 'react';
import { collageService } from '../services/collageService';
import { Collage, CollageInput } from '../types/collage';

export function useCollage() {
  const getCollages = useCallback(async (): Promise<Collage[]> => {
    const res = await collageService.getCollages();
    return res.collages;
  }, []);

  // Returns full response (collage and albumPhotos)
  const getCollage = useCallback(async (id: string): Promise<any> => {
    return collageService.getCollageById(id);
  }, []);

  const createCollage = useCallback(async (input: CollageInput): Promise<Collage> => {
    const res = await collageService.createCollage(input);
    return res.collage;
  }, []);

  const updateCollage = useCallback(async (id: string, input: CollageInput): Promise<Collage> => {
    const res = await collageService.updateCollage(id, input);
    return res.collage;
  }, []);

  const deleteCollage = useCallback(async (id: string): Promise<void> => {
    await collageService.deleteCollage(id);
  }, []);

  return {
    getCollages,
    getCollage,
    createCollage,
    updateCollage,
    deleteCollage,
  };
}
