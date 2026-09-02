import { Suspense } from "react";
import { SignInExperience } from "@/components/auth/SignInExperience";

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-[70svh]" />}>
      <SignInExperience />
    </Suspense>
  );
}
