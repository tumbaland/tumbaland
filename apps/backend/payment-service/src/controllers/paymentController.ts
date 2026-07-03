import { Request, Response } from 'express';
import { BadRequestError } from '@tumbaland/core';
import { Payment } from '../models/Payment';

export const createOneTimePayment = async (req: Request, res: Response): Promise<void> => {
  const email = req.user!.email;
  const { amountCents, currency } = req.body;
  if (!amountCents || amountCents < 50) { throw new BadRequestError('Invalid amount'); }
  const payment = await Payment.create({ userEmail: email, amountCents, currency: currency || 'eur', type: 'one_time', status: 'succeeded' });
  res.status(201).json({ success: true, payment });
};

export const listPayments = async (req: Request, res: Response): Promise<void> => {
  const email = req.user!.email;
  const payments = await Payment.find({ userEmail: email }).sort({ createdAt: -1 }).limit(50);
  res.json({ success: true, payments });
};
