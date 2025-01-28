import {NextResponse} from 'next/server';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import {createClient, type Session} from '@supabase/supabase-js';
import {randomBytes} from 'crypto';
import {supabase} from "../../../../../supabaseClient";

export const runtime = 'nodejs';

// ----------- Interfaces -----------
interface AdminUser {
    id: string;
    email: string;
    // ... plus whatever other fields you might need
}

/** The shape of the request body expected by this route */
interface VerifyRequestBody {
    nonce?: string;
    publicKey?: string;
    signature?: string | { type: 'Buffer'; data: number[] };
}

// ----------- Supabase Admin Helper -----------
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * A small helper to fetch a user by email from Supabase's Admin API (not the client).
 * If you prefer to do it via `supabaseAdmin.auth.admin.listUsers(...)`, you can.
 * This is just a direct fetch to the GoTrue REST endpoint.
 */
async function getUserByEmail(email: string): Promise<AdminUser | undefined> {
    try {


        // For a small/medium user base, you might do a single fetch
        // with a large perPage to capture all users (or enough to find your user).
        const {data, error} = await supabaseAdmin.auth.admin.listUsers({
            page: 1,
            perPage: 10000, // up to 10,000 users returned
        });

        if (error) {
            console.error('[getUserByEmail] Error listing users:', error);
            return undefined;
        }

        // If no users are returned or data is empty, there's nothing to match
        if (!data?.users?.length) {
            return undefined;
        }

        // Manually find the user in memory by matching on email
        const foundUser = data.users.find((u) => u.email === email.toLowerCase());
        return foundUser ? (foundUser as AdminUser) : undefined;
    } catch (err) {
        console.error('[getUserByEmail] Exception:', err);
        return undefined;
    }
}

// ----------- The POST Handler -----------
export async function POST(request: Request) {
    try {
        // 1) Parse JSON from request
        const body: VerifyRequestBody = await request.json() as VerifyRequestBody;
        const {nonce, publicKey, signature} = body;

        console.log('[VERIFY ROUTE] Received body:', body);

        // Basic validations
        if (!nonce || !publicKey || !signature) {
            return NextResponse.json(
                {error: 'Missing nonce, publicKey, or signature'},
                {status: 400}
            );
        }

        // 2) Decode the signature & verify with tweetnacl
        let sigBytes: Uint8Array;
        try {
            if (typeof signature === 'string') {
                // If the signature is a base58 string (common for Phantom)
                sigBytes = bs58.decode(signature);
            } else if (
                typeof signature === 'object' &&
                signature.type === 'Buffer' &&
                Array.isArray(signature.data)
            ) {
                // If the signature came in as { type: 'Buffer', data: [...] }
                sigBytes = new Uint8Array(signature.data);
            } else {
                throw new Error('Signature not in recognized format');
            }

            const msgBytes = new TextEncoder().encode(nonce);
            const pubKeyBytes = bs58.decode(publicKey);

            const isValid = nacl.sign.detached.verify(msgBytes, sigBytes, pubKeyBytes);
            if (!isValid) {
                return NextResponse.json({error: 'Invalid signature'}, {status: 401});
            }
        } catch (err) {
            console.error('[VERIFY ROUTE] Signature decoding error:', err);
            return NextResponse.json({error: 'Invalid signature format'}, {status: 400});
        }

        console.log('[VERIFY ROUTE] ✅ Signature verified for publicKey:', publicKey);

        // 3) Use the publicKey as the unique "email"
        const fakeEmail = `${publicKey}@example.com`;
        console.log(fakeEmail, 'fakeEmail')
        const randomPass = randomBytes(16).toString('hex');

        // 4) Check if the user already exists
        let existingUser = await getUserByEmail(fakeEmail);

        console.log(existingUser, 'existingUser')

        // 5) If user does not exist, create one
        if (!existingUser) {
            console.log('[VERIFY ROUTE] No existing user found. Creating user...');
            const {data, error} = await supabaseAdmin.auth.admin.createUser({
                email: fakeEmail,
                password: randomPass,
                user_metadata: {walletAddress: publicKey},
                email_confirm: true, // so we skip "confirmation required" issues
            });

            if (error || !data?.user) {
                console.error('[VERIFY ROUTE] Error creating user:', error);
                return NextResponse.json(
                    {error: error?.message || 'Failed to create user'},
                    {status: 500}
                );
            }
            existingUser = data.user as AdminUser;
            console.log('[VERIFY ROUTE] Created user with ID:', existingUser.id);
        } else {
            // If user exists, we must update the password to match our new random password
            // otherwise signInWithPassword will fail with "invalid login credentials"
            console.log('[VERIFY ROUTE] Found existing user ID:', existingUser.id, '- updating password...');
            const {data: updatedUser, error: updateError} = await supabaseAdmin.auth.admin.updateUserById(
                existingUser.id,
                {password: randomPass, email_confirm: true}
            );
            const {data: _, error: __} = await supabase.auth.signInWithPassword({
                email: fakeEmail,
                password: randomPass,
            })

            console.log(_, 'user signed in');
            console.log(__, 'user signed in error ')
            if (updateError || !updatedUser) {
                console.error('[VERIFY ROUTE] Failed to update existing user:', updateError);
                return NextResponse.json(
                    {error: updateError?.message || 'Failed to update user'},
                    {status: 500}
                );
            }
        }

        // 6) Now sign them in using the newly set random password
        console.log('[VERIFY ROUTE] Attempting to sign in with randomPass...');
        const {data: signInData, error: signInError} = await supabaseAdmin.auth.signInWithPassword({
            email: fakeEmail,
            password: randomPass,
        });
        const {data: _, error: __} = await supabase.auth.signInWithPassword({
            email: fakeEmail,
            password: randomPass,
        })

        const testdd = await supabase.auth.refreshSession()
        const testff = testdd.data
        console.log(testdd)
        console.log(testff)
        console.log(_, 'user signed in');
        console.log(__, 'user signed in error ')

        if (signInError || !signInData?.session) {
            console.error('[VERIFY ROUTE] Sign-in error:', signInError);
            return NextResponse.json(
                {error: signInError?.message || 'Failed to sign user in'},
                {status: 500}
            );
        }

        // 7) Return session info
        const session: Session = signInData.session;
        console.log('[VERIFY ROUTE] ✔️ Auth flow successful for user:', fakeEmail);

        return NextResponse.json({
            message: 'Signature verified successfully',
            access_token: session.access_token,
            token_type: session.token_type,
            expires_in: session.expires_in,
            refresh_token: session.refresh_token,
            user: signInData.user,
        });
    } catch (error: unknown) {
        console.error('[VERIFY ROUTE] Uncaught error:', error);
        return NextResponse.json({error: 'Internal server error'}, {status: 500});
    }
}