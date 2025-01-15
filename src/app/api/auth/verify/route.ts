

/**
 * By default, Next.js 13 route handlers run in the Edge runtime.
 * But `randomBytes` (crypto) is *not* supported on the Edge.
 * Also, Supabase Admin calls often require a Node environment.
 */
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import {type User, type Session, createClient} from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

/**
 * Admin client with service_role key.
 * - Make sure to keep this key secret (.env).
 * - For example:
 *   NEXT_PUBLIC_SUPABASE_URL=https://xyzcompany.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 */


/** Shape of the request body */
interface VerifyRequestBody {
    nonce?: string;
    publicKey?: string;
    signature?: string;
}

const supabase = createClient( process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''  // <-- Service role key
); // admin acc

export async function POST(request: Request) {
    try {
        // 1) Parse the request
        const body: VerifyRequestBody = await request.json() as VerifyRequestBody;
        const { nonce, publicKey, signature } = body;

        console.log('[VERIFY ROUTE] Incoming body:', body);

        if (!nonce || !publicKey || !signature) {
            console.error('[VERIFY ROUTE] Missing required fields');
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 2) Verify signature with tweetnacl
        //    (Phantom signatures are typically base58-encoded)
        let isValid = false;
        try {
            const sigBytes = bs58.decode(signature);
            const msgBytes = new TextEncoder().encode(nonce);
            const pubKeyBytes = bs58.decode(publicKey);

            isValid = nacl.sign.detached.verify(msgBytes, sigBytes, pubKeyBytes);
        } catch (error) {
            console.error('[VERIFY ROUTE] Error decoding/verify signature:', error);
            return NextResponse.json({ error: 'Invalid signature format' }, { status: 400 });
        }

        if (!isValid) {
            console.error('[VERIFY ROUTE] Signature is invalid');
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        console.log('[VERIFY ROUTE] Signature verified OK for publicKey=', publicKey);

        // 3) Create a "fake" email from the publicKey
        const fakeEmail = `${publicKey}@example.com`;
        const randomPass = randomBytes(16).toString('hex'); // <--- Make sure runtime = 'nodejs'

        // 4) List users to see if we already have this user
        // NOTE: This requires a Supabase library version that supports auth.admin.listUsers
        console.log('[VERIFY ROUTE] Checking if user already exists in Supabase...');
        const { data: listData, error: listErr } = await supabase.auth.admin.listUsers({
            page: 1,
            perPage: 100
        });

        if (listErr) {
            console.error('[VERIFY ROUTE] Error listing users:', listErr);
            return NextResponse.json(
                { error: listErr.message || 'Failed to list users' },
                { status: 500 }
            );
        }

        const existingUser: User | undefined = listData?.users?.find((u) => u.email === fakeEmail);

        let finalUser: User | undefined;

        // 5) If user does not exist, create one
        if (!existingUser) {
            console.log('[VERIFY ROUTE] No existing user found. Creating user...');
            const { data: createData, error: createError } = await supabase.auth.admin.createUser({
                email: fakeEmail,
                password: randomPass,
                user_metadata: { wallet: publicKey },
                email_confirm: true,  // <-- This line ensures the user is immediately "confirmed"
            });

            if (createError || !createData?.user) {
                console.error('[VERIFY ROUTE] Error creating user:', createError);
                return NextResponse.json(
                    { error: createError?.message || 'Failed to create user' },
                    { status: 500 }
                );
            }

            finalUser = createData.user;
            console.log('[VERIFY ROUTE] Created new user with ID:', finalUser.id);
        } else {
            finalUser = existingUser;
            console.log('[VERIFY ROUTE] Found existing user with ID:', finalUser.id);
        }

        // 6) Sign them in with email/password to get a session
        console.log('[VERIFY ROUTE] Attempting to sign in user with password...');
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: fakeEmail,
            password: randomPass
        });

        if (signInError || !signInData?.session) {
            console.error('[VERIFY ROUTE] Sign in error:', signInError);
            return NextResponse.json(
                { error: signInError?.message || 'Failed to sign user in' },
                { status: 500 }
            );
        }

        const session: Session = signInData.session;
        if (!session.access_token) {
            console.error('[VERIFY ROUTE] No access token in session object!');
            return NextResponse.json({ error: 'No access token in session' }, { status: 500 });
        }

        // 7) Return the session info
        console.log('[VERIFY ROUTE] Success! Returning session and user');
        return NextResponse.json({
            message: 'Signature verified successfully',
            access_token: session.access_token,
            token_type: session.token_type,
            expires_in: session.expires_in,
            refresh_token: session.refresh_token,
            user: finalUser, // or session.user
        });
    } catch (error: unknown) {
        console.error('[VERIFY ROUTE] Uncaught error in the handler:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}