import { Client } from '@line/bot-sdk';
import { NextResponse } from 'next/server';
import { requireApiKey } from '@/app/lib/apiAuth';

// Initialize LINE Bot client
const client = new Client({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
    channelSecret: process.env.LINE_CHANNEL_SECRET || '',
});

export async function POST(request: Request) {
    try {
        const auth = requireApiKey(request, 'INTERNAL_API_SECRET');
        if (!auth.ok) return auth.response;

        if (!process.env.LINE_CHANNEL_ACCESS_TOKEN || !process.env.LINE_CHANNEL_SECRET) {
            return NextResponse.json(
                { success: false, message: 'LINE channel credentials are not configured' },
                { status: 500 }
            );
        }

        const body = await request.json();
        const { to, message } = body;

        if (!to || !message) {
            return NextResponse.json({ message: 'Missing "to" or "message" in request body' }, { status: 400 });
        }

        // Create a text message object
        const messageObject = {
            type: 'text',
            text: message,
        } as const;

        // Send the push message
        await client.pushMessage(to, [messageObject]);

        return NextResponse.json({ success: true, message: `Message sent to ${to}` });

    } catch (error: any) {
        console.error('Error sending LINE message:', error.originalError?.response?.data || error);
        return NextResponse.json({ success: false, message: 'Failed to send message' }, { status: 500 });
    }
}
