"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";

/** Legacy entry point — forwards into the org's onboarding wizard. */
export default function OnboardingPage() {
  const router = useRouter();

  useEffect(() => {
    const orgId = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("gtwy_org_id") : null;
    router.replace(orgId ? `/org/${orgId}/onboarding` : "/org");
  }, [router]);

  return <LoadingSpinner />;
}
