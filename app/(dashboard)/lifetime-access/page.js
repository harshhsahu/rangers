"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import MainLayout from "@/components/layoutComponents/MainLayout";
import { useCustomSelector } from "@/customHooks/customSelector";
import { setInCookies } from "@/utils/utility";
import { ORG_ID } from "@/utils/enums";

const LifetimeAccessPage = () => {
  const router = useRouter();
  const { userdetails, currrentOrgDetail } = useCustomSelector((state) => ({
    userdetails: state.userDetailsReducer.userDetails,
    currrentOrgDetail: state?.userDetailsReducer?.organizations?.[ORG_ID],
  }));
  const orgId = ORG_ID;
  const email = userdetails?.email;
  const tallyUrl = `https://tally.so/r/eqZp1q?transparentBackground=1&formEventsForwarding=1&email=${encodeURIComponent(
    email
  )}&orgId=${encodeURIComponent(orgId)}`;
  useEffect(() => {
    // Load Tally embed script
    setInCookies("current_org_id", ORG_ID);
    const script = document.createElement("script");
    script.src = "https://tally.so/widgets/embed.js";
    script.async = true;
    document.head.appendChild(script);

    return () => {
      // Cleanup script on unmount
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);
  useEffect(() => {
    if (currrentOrgDetail?.meta?.unlimited_access) {
      router.push(`/agents`);
    }
  }, [currrentOrgDetail]);
  return (
    <MainLayout withPadding={false}>
      <div className="min-h-screen bg-base-100">
        <div className="flex-1 relative">
          <iframe
            data-tally-src={tallyUrl}
            width="100%"
            height="100%"
            frameBorder="0"
            marginHeight="0"
            marginWidth="0"
            title="Rangers - Lifetime Free Access"
            className="w-full min-h-[100vh]"
          />
        </div>
      </div>
    </MainLayout>
  );
};

export default LifetimeAccessPage;
