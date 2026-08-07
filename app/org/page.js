"use client";
import CreateOrg from "@/components/CreateNewOrg";
import Protected from "@/components/Protected";
import ServiceInitializer from "@/components/organization/ServiceInitializer";
import { ThemeManager } from "@/customHooks/useThemeManager";
import { useCustomSelector } from "@/customHooks/customSelector";
import { setCurrentOrgIdAction } from "@/store/action/orgAction";
import { setInCookies, getFromCookies, openModal } from "@/utils/utility";
import { ensureOrgAndRedirect } from "@/utils/ensureOrgRedirect";
import { createAndStoreInternalJwt } from "@/utils/internalAuth";
import { MODAL_TYPE } from "@/utils/enums";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import LoadingSpinner from "@/components/LoadingSpinner";

/**
 * Org entry page — no longer shows the workspace picker.
 * Redirects to an existing org, or auto-creates one for new users.
 */
function Page() {
  const [isRedirecting, setIsRedirecting] = useState(true);
  const dispatch = useDispatch();
  const route = useRouter();
  const searchParams = useSearchParams();
  const organizations = useCustomSelector((state) => state.userDetailsReducer.organizations);
  const userDetails = useCustomSelector((state) => state.userDetailsReducer.userDetails);

  const handleSwitchOrg = useCallback(
    async (id) => {
      try {
        await createAndStoreInternalJwt(id);
        dispatch(setCurrentOrgIdAction(id));
        route.push(`/org/${id}/agents`);
      } catch (error) {
        console.error("Error switching organization", error);
      }
    },
    [dispatch, route]
  );

  useEffect(() => {
    const redirectPreviousUrl = searchParams.get("redirect_previous_url");
    if (redirectPreviousUrl === "true") {
      const currentOrgId = getFromCookies("current_org_id");
      setInCookies("unlimited_access", true);
      if (currentOrgId) {
        route.push(`/org/${currentOrgId}/agents`);
        return;
      }
    }

    let cancelled = false;
    const run = async () => {
      try {
        // Wait until user details have loaded
        if (!userDetails?.id) return;
        await ensureOrgAndRedirect({
          organizations,
          user: userDetails,
          dispatch,
          router: route,
          replace: true,
        });
      } catch (error) {
        console.error("Failed to redirect to organization", error);
        if (!cancelled) setIsRedirecting(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [searchParams, route, organizations, userDetails, dispatch]);

  if (isRedirecting) {
    return <LoadingSpinner />;
  }

  // Fallback if auto-create fails — still allow manual create via modal
  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-base-100 px-2 md:px-0">
      <ServiceInitializer />
      <ThemeManager userType="default" />
      <div className="text-center space-y-4">
        <p className="text-base-content/70">Unable to open a workspace automatically.</p>
        <button className="btn btn-primary btn-sm" onClick={() => openModal(MODAL_TYPE.CREATE_ORG_MODAL)}>
          Create Workspace
        </button>
      </div>
      <CreateOrg handleSwitchOrg={handleSwitchOrg} />
    </div>
  );
}

export default Protected(Page);
