export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Session } from '@supabase/supabase-js';

interface SignInRequestBody {
    email?: string;
    password?: string;
}

// Admin client (service role)
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function POST(request: Request) {
    try {
        const { email, password }: SignInRequestBody = await request.json() as SignInRequestBody;

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Missing email or password' },
                { status: 400 }
            );
        }

        // Attempt sign-in
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (signInError || !signInData?.session) {
            return NextResponse.json(
                { error: signInError?.message || 'Failed to sign user in' },
                { status: 401 }
            );
        }

        const session: Session = signInData.session;
        return NextResponse.json({
            message: 'Sign in successful',
            access_token: session.access_token,
            token_type: session.token_type,
            expires_in: session.expires_in,
            refresh_token: session.refresh_token,
            user: signInData.user ?? signInData.session.user,
        });
    } catch (error) {
        console.error('[SIGN-IN HELPER] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}