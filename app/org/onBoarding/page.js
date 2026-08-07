"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";

/** Onboarding removed — bounce to /org (or gtwy org agents). */
export default function OnboardingPage() {
  const router = useRouter();

  useEffect(() => {
    const orgId = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("gtwy_org_id") : null;
    router.replace(orgId ? `/org/${orgId}/agents` : "/org");
  }, [router]);

  return <LoadingSpinner />;
}
