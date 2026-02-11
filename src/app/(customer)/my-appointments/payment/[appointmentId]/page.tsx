import { redirect } from 'next/navigation';

export default async function LegacyMyAppointmentsPaymentPage({
  params,
}: {
  params: Promise<{ appointmentId: string }>;
}) {
  const { appointmentId } = await params;
  redirect(`/payment/${appointmentId}`);
}
