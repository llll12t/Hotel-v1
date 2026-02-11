import { redirect } from 'next/navigation';

export default async function LegacyMyAppointmentsReviewPage({
  params,
}: {
  params: Promise<{ appointmentId: string }>;
}) {
  const { appointmentId } = await params;
  redirect(`/review/${appointmentId}`);
}
