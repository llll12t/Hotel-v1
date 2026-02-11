import { Suspense } from "react";
import LoadingScreen from "@/app/components/common/LoadingScreen";
import SelectDateTimeClient from "./SelectDateTimeClient";

export default function SelectDateTimePage() {
  return (
    <Suspense
      fallback={<LoadingScreen spinnerStyle={{ animationDuration: "3s" }} />}
    >
      <SelectDateTimeClient />
    </Suspense>
  );
}
