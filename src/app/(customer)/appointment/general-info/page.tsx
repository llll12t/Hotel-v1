import { Suspense } from "react";
import LoadingScreen from "@/app/components/common/LoadingScreen";
import GeneralInfoClient from "./GeneralInfoClient";

export default function GeneralInfoPage() {
  return (
    <Suspense
      fallback={<LoadingScreen spinnerStyle={{ animationDuration: "3s" }} />}
    >
      <GeneralInfoClient />
    </Suspense>
  );
}
