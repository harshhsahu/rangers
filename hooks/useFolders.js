import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

export const useFolders = (resourceType, orgId, passedIsEmbedUser) => {
  const dispatch = useDispatch();
  const foldersStateRaw = useSelector((state) => state.folderReducer?.folders);
  const foldersState = Array.isArray(foldersStateRaw) ? foldersStateRaw : [];

  useEffect(() => {
    if (!passedIsEmbedUser) {
      try {
        dispatch(getAllFoldersAction());
      } catch (err) {
        console.error("Failed to dispatch getAllFoldersAction:", err);
      }
    }
  }, [dispatch, passedIsEmbedUser]);

  // Filter folders by resourceType
  const folders = foldersState.filter((f) => f && f.type === resourceType);

  return {
    folders,
  };
};
export default useFolders;
