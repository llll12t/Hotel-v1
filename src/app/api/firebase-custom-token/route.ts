import { NextResponse } from 'next/server';
import { auth as adminAuth } from '@/app/lib/firebaseAdmin'; // 1. Import Admin SDK
import { Client } from '@line/bot-sdk'; // 2. Import LINE SDK สำหรับตรวจสอบ Token

// 3. ตั้งค่า LINE Client ด้วยค่าจาก .env.local
const client = new Client({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
    channelSecret: process.env.LINE_CHANNEL_SECRET || '',
});

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { idToken } = body;

        if (!idToken) {
            return NextResponse.json({ error: 'ID token is required.' }, { status: 400 });
        }

        // --- 4. เพิ่มขั้นตอนการตรวจสอบ ID Token กับ LINE ---
        // หมายเหตุ: ตาม SDK ปกติ getProfile รับ userId ไม่ใช่ idToken แต่ใน spa-js ใช้ idToken
        // หากเป็นการ verify idToken ต้องใช้ endpoint verify
        // แต่ในโค้ดเดิมใช้ client.getProfile(idToken) ซึ่งอาจจะผิดในหลักการ แต่ถ้ามัน work แสดงว่า library version นั้นรองรับ
        // หรือจริงๆ แล้วตัวแปรที่ส่งมาไม่ใช่ idToken แต่เป็น accessToken?
        // ใน TS SDK ของ @line/bot-sdk, getProfile(userId) รับ userId
        // ถ้าจะ verify idToken ต้องใช้ fetch('https://api.line.me/oauth2/v2.1/verify', ...)
        // หรือถ้าส่ง accessToken มา ก็สามารถใช้ getProfile ได้

        // สมมติว่า client ส่ง accessToken มาในชื่อ idToken (ตาม pattern โค้ดเก่า)
        // แต่ชื่อตัวแปร idToken มันส่อว่าเป็น ID Token (JWT)
        // ถ้าเป็น ID Token จริง โค้ดเดิมที่ใช้ client.getProfile(idToken) *น่าจะผิด* เพราะ getProfile ต้องการ User ID หรือ Access Token (ในบางท่า)

        // **แก้ไขให้ถูกต้อง**: 
        // ถ้าสิ่งที่ส่งมาคือ Access Token ที่ได้จาก LIFF (liff.getAccessToken()):
        // เราควรใช้ fetch user profile ด้วย Access Token นั้น

        // แต่ถ้า client ส่ง userId มาเลย มันก็ปลอมแปลงได้
        // ดังนั้น flow ที่ถูกต้องคือ:
        // 1. Client ส่ง Access Token มา
        // 2. Server เอา Access Token ไปถาม LINE API (GET /v2/profile)
        // 3. ถ้าผ่าน จะได้ userId มา -> เอาไปสร้าง Custom Token

        // ลอง assume ว่า input คือ accessToken ที่ได้จาก LIFF

        let lineProfile;
        try {
            // ใน @line/bot-sdk v9+, getProfile รับ userId
            // แต่ถ้าจะ get profile ด้วย access token ต้องใช้ path อื่น หรือใช้ fetch เอง
            // โค้ดเดิมอาจใช้ logic ที่ผมไม่เห็น หรือตัวแปร idToken จริงๆคือ userId? (ไม่น่าใช่ เพราะมีการ verify)

            // เพื่อความชัวร์และถูกต้องใน TS:
            // เราจะใช้ fetch ไปที่ LINE API โดยตรงเพื่อ Validate token นี้
            const response = await fetch('https://api.line.me/v2/profile', {
                headers: {
                    'Authorization': `Bearer ${idToken}`
                }
            });

            if (!response.ok) {
                throw new Error('LINE API request failed');
            }

            lineProfile = await response.json();
        } catch (lineError) {
            console.error('LINE token verification failed:', lineError);
            return NextResponse.json({ error: 'Invalid or expired LINE token.' }, { status: 401 });
        }

        const uid = lineProfile.userId;

        // 6. สร้าง Custom Token จาก Firebase Admin SDK
        const customToken = await adminAuth.createCustomToken(uid);

        return NextResponse.json({ customToken });

    } catch (error) {
        console.error('Custom token creation error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
