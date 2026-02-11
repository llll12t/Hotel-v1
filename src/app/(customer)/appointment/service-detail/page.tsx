import { Suspense } from "react";
import LoadingScreen from "@/app/components/common/LoadingScreen";
import ServiceDetailClient from "./ServiceDetailClient";

export default function ServiceDetailPage() {
  return (
    <Suspense
      fallback={
        <LoadingScreen
          color="#553734"
          backgroundClassName=""
          spinnerStyle={{ animationDuration: "3s" }}
        />
      }
    >
      <ServiceDetailClient />
    </Suspense>
  );
}
