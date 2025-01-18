// api/auth/nonce.ts
import { v4 as uuidv4 } from 'uuid';
import {NextResponse} from "next/server";


//eslint-disable-next-line @typescript-eslint/require-await
export async function GET() {
    const nonce = uuidv4();
    return NextResponse.json({ nonce });
}