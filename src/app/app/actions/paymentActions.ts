"use server";

import QRCode from 'qrcode';

// CRC16-CCITT calculation
function calculateCRC16(input: string): number {
    const encoder = new TextEncoder();
    const buf = encoder.encode(input);
    let crc = 0xFFFF;

    buf.forEach(function (b) {
        crc ^= (b & 0xFF) << 8;
        for (let i = 0; i < 8; i++) {
            crc = (crc & 0x8000) !== 0
                ? ((crc << 1) ^ 0x1021)
                : (crc << 1);
            crc &= 0xFFFF;
        }
    });

    return crc;
}

function generatePromptPayPayload(id: string, amount: number): string {
    function f(tag: string, value: string): string {
        const len = ("0" + value.length).slice(-2);
        return tag + len + value;
    }

    function formatId(id: string): string {
        return /^\d{10}$/.test(id)
            ? "0066" + id.substring(1)
            : id;
    }

    let p = "";
    p += f("00", "01");
    p += f("01", "11");

    let mp = "";
    mp += f("00", "A000000677010111");
    mp += f("01", formatId(id));
    p += f("29", mp);

    p += f("52", "0000");
    p += f("53", "764");
    if (amount && amount > 0) {
        p += f("54", amount.toFixed(2));
    }
    p += f("58", "TH");
    p += f("59", "BEAUTY_SALON");
    p += f("60", "BANGKOK");

    const raw = p + "6304";
    const crc = calculateCRC16(raw).toString(16).toUpperCase();
    const paddedCrc = ("0000" + crc).slice(-4);
    p += "63" + "04" + paddedCrc;

    return p;
}


export async function generateQrCodePayload(promptPayId: string, amount: number) {
    try {
        if (process.env.NODE_ENV !== 'production') {
            console.log('=== PromptPay QR Code Generation ===');
            console.log('PromptPay ID:', promptPayId);
            console.log('Amount:', amount);
        }

        const promptPayPayload = generatePromptPayPayload(promptPayId, amount);
        if (process.env.NODE_ENV !== 'production') {
            console.log('Generated PromptPay Payload:', promptPayPayload);
        }

        if (!promptPayPayload.startsWith('000201')) {
            throw new Error('Invalid PromptPay payload format');
        }

        const qrCodeDataUrl = await QRCode.toDataURL(promptPayPayload, {
            errorCorrectionLevel: 'M',
            type: 'image/png',
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            },
            width: 300
        });

        return qrCodeDataUrl;

    } catch (error: any) {
        console.error('Error generating QR code payload:', error);
        throw new Error(`Failed to generate QR code: ${error.message}`);
    }
}

export async function generateQrCodeFromText(text: string) {
    if (!text) {
        throw new Error("Text for QR code generation is required.");
    }
    try {
        const qrCodeDataUrl = await QRCode.toDataURL(text, {
            errorCorrectionLevel: 'H',
            type: 'image/png',
            margin: 1,
        });
        return qrCodeDataUrl;
    } catch (error) {
        console.error('Error generating QR code from text:', error);
        throw new Error('Failed to generate QR code.');
    }
}
