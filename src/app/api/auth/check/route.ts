import {NextResponse} from 'next/server';

//eslint-disable-next-line
export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.split(' ')[1];

    if (!token) {
        return NextResponse.json({error: 'Token not provided'}, {status: 401});
    }

    try {
        // Декодируем payload JWT (без проверки подписи)
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        //eslint-disable-next-line
        const jsonPayload = Buffer.from(base64, 'base64').toString('utf-8');
        //eslint-disable-next-line
        const payload = JSON.parse(jsonPayload);

        const now = Math.floor(Date.now() / 1000);
        //eslint-disable-next-line
        if (payload.exp && payload.exp < now) {
            return NextResponse.json({error: 'Token expired'}, {status: 401});
        }

        return NextResponse.json({message: 'Token valid'}, {status: 200});
    } catch (err) {
        console.error('Error decoding token:', err);
        return NextResponse.json({error: 'Invalid token'}, {status: 400});
    }
}