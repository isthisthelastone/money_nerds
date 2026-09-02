import { Suspense } from "react";
import { SignInExperience } from "@/components/auth/SignInExperience";

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-[70svh]" />}>
      <SignInExperience mode="sign-up" />
    </Suspense>
  );
}
