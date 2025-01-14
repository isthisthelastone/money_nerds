// api/auth/nonce.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const nonce = uuidv4();
    // You could also store nonce in DB if you want to verify it's one-time use
    res.status(200).json({ nonce });
}