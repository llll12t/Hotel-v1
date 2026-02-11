import { sendAppointmentReminders } from '@/app/actions/reminderActions';
import { NextRequest, NextResponse } from 'next/server';
import { requireApiKey } from '@/app/lib/apiAuth';

export async function GET(request: NextRequest) {
    try {
        const auth = requireApiKey(request, 'CRON_SECRET');
        if (!auth.ok) return auth.response;

        console.log('Cron job triggered: sending appointment reminders');

        const result = await sendAppointmentReminders();

        if (result.success) {
            return NextResponse.json({
                success: true,
                message: 'Appointment reminders processed successfully',
                data: result
            });
        } else {
            return NextResponse.json({
                success: false,
                message: 'Failed to process appointment reminders',
                error: result.error
            }, { status: 500 });
        }

    } catch (error: any) {
        console.error('Error in reminder cron job:', error);
        return NextResponse.json({
            success: false,
            message: 'Internal server error',
            error: error.message
        }, { status: 500 });
    }
}
