"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useLayoutEffect, useState } from "react";
import { userDetails } from "@/store/action/userDetailsAction";
import { useDispatch } from "react-redux";
import { useCustomSelector } from "@/customHooks/customSelector";
import ErrorPage from "@/app/not-found";
import { getFromCookies, removeCookie, setInCookies } from "@/utils/utility";
import { trackAuthEvent } from "@/utils/posthog";
import { PROXY_SCRIPT_SRC } from "@/utils/enums";
import { loginWithProxyAuthToken } from "@/utils/internalAuth";
import { setCurrentOrgIdAction } from "@/store/action/orgAction";

/**
 * Same chain as public/gtwy.js embed:
 * proxy_auth_token → internal-login (sign embed JWT + POST /api/embed/login)
 * → store returned GTWY session token as local_token
 * → call GTWY APIs with Authorization: local_token
 */
const WithAuth = (Children) => {
  return (props) => {
    const router = useRouter();
    const dispatch = useDispatch();
    const pathName = usePathname();
    const [loading, setLoading] = useState(true);
    const searchParams = useSearchParams();
    const proxy_auth_token = searchParams.get("proxy_auth_token");

    const isEmbedUser = useCustomSelector((state) => state.appInfoReducer.embedUserDetails.isEmbedUser);

    useLayoutEffect(() => {
      const runEffect = async (isEmbedUser) => {
        const proxyAuthToken = proxy_auth_token;
        const proxyToken = getFromCookies("proxy_token");
        let redirectionUrl = getFromCookies("previous_url") || "/org";

        if (isEmbedUser) {
          const org_id = sessionStorage.getItem("gtwy_org_id");
          if (sessionStorage.getItem("local_token") && org_id) {
            router.replace(`/org/${org_id}/agents`);
            return;
          }
          setLoading(false);
          <ErrorPage />;
          return;
        }

        // Already logged in — go to GTWY org from last embed/login
        if (proxyToken && (getFromCookies("local_token") || sessionStorage.getItem("local_token"))) {
          const gtwyOrg = sessionStorage.getItem("gtwy_org_id");
          router.replace(gtwyOrg ? `/org/${gtwyOrg}/agents` : "/org");
          return;
        }

        if (proxyAuthToken) {
          setLoading(true);

          setInCookies("proxy_token", proxyAuthToken);
          if (typeof sessionStorage !== "undefined") {
            sessionStorage.setItem("proxy_token", proxyAuthToken);
          }

          // internal-login → embed JWT → GTWY /api/embed/login → session token
          const auth = await loginWithProxyAuthToken(proxyAuthToken);
          if (!auth?.token || !auth?.org_id) {
            console.error("internal login / GTWY embed login failed");
            setLoading(false);
            return;
          }

          dispatch(setCurrentOrgIdAction(auth.org_id));
          await dispatch(userDetails());

          trackAuthEvent("user_logged_in", {
            user_id: auth.user_id || searchParams.get("user_ref_id"),
            org_id: auth.org_id,
          });

          const orgFromUrl = redirectionUrl?.match?.(/\/org\/(\d+)\//)?.[1];
          const targetOrg = orgFromUrl || auth.org_id;
          const redirectTarget =
            redirectionUrl && redirectionUrl !== "/org" && !redirectionUrl.endsWith("/org")
              ? redirectionUrl
              : `/org/${targetOrg}/agents`;

          router.replace(redirectTarget);
          removeCookie("previous_url");
          return;
        }

        setLoading(false);

        const configuration = {
          referenceId: process.env.NEXT_PUBLIC_REFERENCEID,
          type: "authorization",
          addInfo: {
            redirect_path: "/login",
          },
          success: (data) => {
            console.dir("success response", data);
          },
          failure: (error) => {
            console.error("failure reason", error);
          },
        };
        const script = document.createElement("script");
        script.type = "text/javascript";
        script.onload = () => {
          const checkInitVerification = setInterval(() => {
            if (typeof initVerification === "function") {
              clearInterval(checkInitVerification);
              initVerification(configuration);
            }
          }, 100);
        };
        script.src = PROXY_SCRIPT_SRC;
        document.body.appendChild(script);
      };

      runEffect(isEmbedUser);
    }, [isEmbedUser, pathName, proxy_auth_token]);

    return <Children {...props} loading={loading} />;
  };
};

export default WithAuth;
