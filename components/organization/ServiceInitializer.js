import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { usePathname } from "next/navigation";
import { getServiceAction } from "@/store/action/serviceAction";
import { getModelAction } from "@/store/action/modelAction";
import { userDetails } from "@/store/action/userDetailsAction";
import { useCustomSelector } from "@/customHooks/customSelector";
import Protected from "../Protected";

const ServiceInitializer = ({ isEmbedUser }) => {
  const dispatch = useDispatch();
  const pathname = usePathname();
  const SERVICES = useCustomSelector((state) => state.serviceReducer.services);
  const isOrgPage = pathname === "/org" || pathname.endsWith("/org");

  // Services and models are always re-fetched so newly added ones show up
  // without a hard refresh.
  useEffect(() => {
    if (isOrgPage && !isEmbedUser) dispatch(userDetails());
    dispatch(getServiceAction());
  }, [dispatch, isOrgPage]);

  // Keyed on the service names rather than the array, so the services
  // refetch above does not fetch every model a second time.
  const serviceKeys = Array.isArray(SERVICES)
    ? SERVICES.map((service) => service?.value)
        .filter(Boolean)
        .join(",")
    : "";

  useEffect(() => {
    if (!serviceKeys) return undefined;

    const timer = setTimeout(() => {
      serviceKeys.split(",").forEach((service) => dispatch(getModelAction({ service })));
    }, 1000);
    return () => clearTimeout(timer);
  }, [dispatch, serviceKeys, isOrgPage]);

  return null;
};

export default Protected(ServiceInitializer);
