import { createOrgAction, setCurrentOrgIdAction } from "@/store/action/orgAction";
import { userDetails as fetchUserDetails } from "@/store/action/userDetailsAction";
import { createAndStoreInternalJwt, getStoredGtwyOrgId } from "@/utils/internalAuth";

/**
 * Redirect into GTWY org from embed/login session.
 * No switchOrg / localToken — JWT already exchanged via /api/embed/login.
 */
export const ensureOrgAndRedirect = async ({ organizations, user, dispatch, router, replace = true }) => {
  const navigate = replace ? router.replace.bind(router) : router.push.bind(router);

  const gtwyOrgId = getStoredGtwyOrgId();
  if (gtwyOrgId) {
    dispatch(setCurrentOrgIdAction(gtwyOrgId));
    navigate(`/org/${gtwyOrgId}/agents`);
    return gtwyOrgId;
  }

  const orgs = Array.isArray(organizations) ? {} : organizations || {};
  const orgIds = Object.keys(orgs);

  const go = async (id) => {
    await createAndStoreInternalJwt(id);
    const resolved = getStoredGtwyOrgId() || id;
    dispatch(setCurrentOrgIdAction(resolved));
    navigate(`/org/${resolved}/agents`);
    return resolved;
  };

  if (orgIds.length > 0) {
    const preferredId =
      (user?.currentCompany?.id && orgs[user.currentCompany.id] && String(user.currentCompany.id)) || orgIds[0];
    return go(preferredId);
  }

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
            const id = await go(data.id);
            resolve(id);
          } catch (error) {
            reject(error);
          }
        },
        (error) => reject(error)
      )
    );
  });
};
