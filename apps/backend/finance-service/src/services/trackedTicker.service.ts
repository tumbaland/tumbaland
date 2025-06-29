import TrackedTicker from '../models/TrackedTicker';

export const getAllTrackedTickers = async () => {
  return TrackedTicker.find().sort({ ticker: 1 });
};

export const createTrackedTicker = async (data: { ticker: string; displayName: string; description?: string; isActive?: boolean }) => {
  const tracked = new TrackedTicker({
    ...data,
    dateAdded: new Date(),
    isActive: data.isActive !== undefined ? data.isActive : true
  });
  return tracked.save();
};

export const updateTrackedTicker = async (id: string, data: { ticker?: string; displayName?: string; description?: string; isActive?: boolean }) => {
  return TrackedTicker.findByIdAndUpdate(id, data, { new: true });
};

export const deleteTrackedTicker = async (id: string) => {
  return TrackedTicker.findByIdAndDelete(id);
};
