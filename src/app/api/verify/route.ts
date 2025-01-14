// app/api/auth/verify/route.ts
import { NextResponse } from 'next/server'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { createClient, type User, type Session } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

/**
 * Admin client with service_role key.
 * Make sure to keep this key secret (e.g., in .env).
 */
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

/** Shape of the request body */
interface VerifyRequestBody {
    nonce?: string
    publicKey?: string
    signature?: string
}

export async function POST(request: Request) {
    try {
        // 1) Parse the request
        const body: VerifyRequestBody = await request.json() as VerifyRequestBody
        const { nonce, publicKey, signature } = body

        if (!nonce || !publicKey || !signature) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // 2) Verify signature with tweetnacl
        const sigBytes = bs58.decode(signature)
        const msgBytes = new TextEncoder().encode(nonce)
        const pubKeyBytes = bs58.decode(publicKey)

        const isValid = nacl.sign.detached.verify(msgBytes, sigBytes, pubKeyBytes)
        if (!isValid) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }

        // 3) Create a "fake" email from the publicKey
        const fakeEmail = `${publicKey}@example.com`
        const randomPass = randomBytes(16).toString('hex')

        // 4) List users (page=1, perPage=100)
        //    then find the one with the matching fakeEmail
        const { data: listData, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
            page: 1,
            perPage: 100
        })

        if (listErr) {
            console.error('Error listing users:', listErr)
            return NextResponse.json(
                { error: listErr.message || 'Failed to list users' },
                { status: 500 }
            )
        }

        // Manually search for the user with that email
        const existingUser: User | undefined = listData?.users?.find(u => u.email === fakeEmail)

        let finalUser: User | undefined

        // 5) If user does not exist, create one
        if (!existingUser) {
            const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
                email: fakeEmail,
                password: randomPass,
                user_metadata: { wallet: publicKey },
            })

            if (createError || !createData?.user) {
                console.error('Error creating user:', createError)
                return NextResponse.json(
                    { error: createError?.message || 'Failed to create user' },
                    { status: 500 }
                )
            }

            finalUser = createData.user
        } else {
            finalUser = existingUser
        }

        // Double-check we have a user
        if (!finalUser) {
            return NextResponse.json(
                { error: 'Failed to create or retrieve user' },
                { status: 500 }
            )
        }

        // 6) Sign them in with email/password to get a session
        const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
            email: fakeEmail,
            password: randomPass
        })

        if (signInError || !signInData?.session) {
            console.error('Sign in error:', signInError)
            return NextResponse.json(
                { error: signInError?.message || 'Failed to sign user in' },
                { status: 500 }
            )
        }

        const session: Session = signInData.session
        if (!session.access_token) {
            return NextResponse.json({ error: 'No access token in session' }, { status: 500 })
        }

        // 7) Return the session info + user if you want
        return NextResponse.json({
            message: 'Signature verified successfully',
            access_token: session.access_token,
            token_type: session.token_type,
            expires_in: session.expires_in,
            refresh_token: session.refresh_token,
            user: finalUser, // or session.user
        })
    } catch (error: unknown) {
        console.error('Verify route error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}