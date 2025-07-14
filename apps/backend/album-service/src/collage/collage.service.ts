import { CollageInput } from './collage.types';
import { CollageModel, ICollage } from './collage.model';

export const createCollage = async (data: CollageInput): Promise<ICollage> => {
  const collage = new CollageModel(data);
  await collage.save();
  return collage;
};

export const updateCollage = async (id: string, data: CollageInput): Promise<ICollage | null> => {
  const collage = await CollageModel.findByIdAndUpdate(id, data, { new: true });
  return collage;
};

export const getCollageById = async (id: string): Promise<ICollage | null> => {
  return CollageModel.findById(id);
};

export const getCollageList = async (albumId?: string): Promise<ICollage[]> => {
  const filter = albumId ? { albumId } : {};
  return CollageModel.find(filter).sort({ createdAt: -1 });
};

export const deleteCollage = async (id: string): Promise<void> => {
  await CollageModel.findByIdAndDelete(id);
};
