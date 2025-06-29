import UserPortfolio from '../models/UserPortfolio';

export const getAllUserPortfolios = async () => {
  return UserPortfolio.find().sort({ symbol: 1 });
};

export const createUserPortfolio = async (data: { symbol: string; quantity: number; avgBuyPrice: number; buyDate?: Date; notes?: string }) => {
  const portfolio = new UserPortfolio(data);
  return portfolio.save();
};

export const updateUserPortfolio = async (id: string, data: { symbol?: string; quantity?: number; avgBuyPrice?: number; buyDate?: Date; notes?: string }) => {
  return UserPortfolio.findByIdAndUpdate(id, data, { new: true });
};

export const deleteUserPortfolio = async (id: string) => {
  return UserPortfolio.findByIdAndDelete(id);
};
