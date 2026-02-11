/**
 * Barrel file: re-exports all flex templates from sub-modules.
 * 
 * ไฟล์นี้ถูก refactor จาก 1 ไฟล์ 944 บรรทัด → 4 ไฟล์ย่อย:
 *   - flex/helpers.ts           — shared utilities
 *   - flex/paymentTemplates.ts  — payment-related templates
 *   - flex/reviewTemplates.ts   — review-related templates
 *   - flex/appointmentTemplates.ts — appointment lifecycle templates
 */

export { createPaymentFlexTemplate, createPaymentConfirmationFlexTemplate } from './flex/paymentTemplates';
export { createReviewFlexTemplate, createReviewThankYouFlexTemplate } from './flex/reviewTemplates';
export {
    createAppointmentConfirmedFlexTemplate,
    createServiceCompletedFlexTemplate,
    createAppointmentCancelledFlexTemplate,
    createNewBookingFlexTemplate,
    createAppointmentReminderFlexTemplate,
    createDailyAppointmentNotificationFlexTemplate,
    createCheckInFlexTemplate
} from './flex/appointmentTemplates';
