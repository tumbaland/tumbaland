import Joi from 'joi';

export const userPortfolioSchema = Joi.object({
  symbol: Joi.string().required(),
  quantity: Joi.number().required(),
  avgBuyPrice: Joi.number().required(),
  buyDate: Joi.string().isoDate().optional(),
  notes: Joi.string().allow('').optional(),
  groupId: Joi.string().optional()
});

export const trackedTickerSchema = Joi.object({
  ticker: Joi.string().required(),
  displayName: Joi.string().required(),
  description: Joi.string().allow('').optional(),
  isActive: Joi.boolean().optional(),
  groupId: Joi.string().optional()
});
