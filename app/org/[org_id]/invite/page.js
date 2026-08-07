"use client";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";

/** Members / invite removed — redirect to agents. */
export default function InvitePage() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/org/${params?.org_id}/agents`);
  }, [params?.org_id, router]);

  return <LoadingSpinner />;
}
