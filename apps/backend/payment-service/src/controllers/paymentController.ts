import { Request, Response } from 'express';
import { Payment } from '../models/Payment';

export const createOneTimePayment = (req: Request, res: Response): void => {
  (async () => {
    const email = req.user!.email;
    const { amountCents, currency } = req.body;
    if (!amountCents || amountCents < 50) { res.status(400).json({ success: false, message: 'invalid amount' }); return; }
  const payment = await Payment.create({ userEmail: email, amountCents, currency: currency || 'eur', type: 'one_time', status: 'succeeded' });
    res.status(201).json({ success: true, payment });
  })().catch(err => { console.error('createOneTimePayment error', err); res.status(500).json({ success: false, message: 'internal error' }); });
};

export const listPayments = (req: Request, res: Response): void => {
  (async () => {
    const email = req.user!.email;
    const payments = await Payment.find({ userEmail: email }).sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, payments });
  })().catch(err => { console.error('listPayments error', err); res.status(500).json({ success: false, message: 'internal error' }); });
};
