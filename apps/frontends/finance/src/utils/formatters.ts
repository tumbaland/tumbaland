// Utility functions for formatting

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

export const formatPercentage = (percentage: number): string => {
  return `${percentage.toFixed(2)}%`;
};

export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString();
};
