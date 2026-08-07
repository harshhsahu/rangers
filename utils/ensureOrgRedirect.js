import { switchOrg, switchUser } from "@/config/index";
import { createOrgAction, setCurrentOrgIdAction } from "@/store/action/orgAction";
import { userDetails as fetchUserDetails } from "@/store/action/userDetailsAction";
import { setInCookies } from "@/utils/utility";

/**
 * Ensures the user has an organization and redirects to its agents page.
 * If no orgs exist, creates a default workspace first.
 */
export const ensureOrgAndRedirect = async ({ organizations, user, dispatch, router, replace = true }) => {
  const orgs = Array.isArray(organizations) ? {} : organizations || {};
  const orgIds = Object.keys(orgs);
  const navigate = replace ? router.replace.bind(router) : router.push.bind(router);

  const switchAndGo = async (id, name) => {
    await switchOrg(id);
    const localToken = await switchUser({ orgId: id, orgName: name });
    setInCookies("local_token", localToken.token);
    dispatch(setCurrentOrgIdAction(id));
    navigate(`/org/${id}/agents`);
  };

  if (orgIds.length > 0) {
    const preferredId =
      (user?.currentCompany?.id && orgs[user.currentCompany.id] && String(user.currentCompany.id)) || orgIds[0];
    const org = orgs[preferredId];
    await switchAndGo(preferredId, org?.name || "Workspace");
    return preferredId;
  }

  // No orgs — create a default workspace and redirect into it
  const workspaceName = user?.name ? `${user.name}'s Workspace` : "My Workspace";
  const dataToSend = {
    company: {
      name: workspaceName,
      meta: {
        about: "",
        identifier: "Asia/Kolkata",
        offSet: "+05:30",
      },
      timezone: "+05:30",
    },
  };

  return new Promise((resolve, reject) => {
    dispatch(
      createOrgAction(
        dataToSend,
        async (data) => {
          try {
            await dispatch(fetchUserDetails());
            await switchAndGo(data.id, data.name || workspaceName);
            resolve(data.id);
          } catch (error) {
            reject(error);
          }
        },
        (error) => reject(error)
      )
    );
  });
};
