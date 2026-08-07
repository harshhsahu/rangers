import React, { createContext, useContext, useEffect, useState } from "react";

export const FolderContext = createContext(null);

export const FolderProvider = ({ children }) => {
  const [activeFolderId, setActiveFolderIdState] = useState(null); // active folder id can be null or uncategorized

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("activeFolderId_" + window.location.pathname);
      if (saved !== null) {
        setActiveFolderIdState(saved === "null" ? null : saved);
      }
    }
  }, []);

  const setActiveFolderId = (id) => {
    setActiveFolderIdState(id);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("activeFolderId_" + window.location.pathname, id === null ? "null" : id);
    }
  };

  const [draggedResourceId, setDraggedResourceId] = useState(null);
  const [selectedResourceIds, setSelectedResourceIds] = useState([]);
  const [collapsedGroups, setCollapsedGroups] = useState({});

  const toggleGroupCollapse = (folderId) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  };

  const toggleSelectResource = (id) => {
    setSelectedResourceIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const clearSelection = () => setSelectedResourceIds([]);

  return (
    <FolderContext.Provider
      value={{
        activeFolderId,
        setActiveFolderId,
        draggedResourceId,
        setDraggedResourceId,
        selectedResourceIds,
        setSelectedResourceIds,
        toggleSelectResource,
        clearSelection,
        collapsedGroups,
        toggleGroupCollapse,
      }}
    >
      {children}
    </FolderContext.Provider>
  );
};

export const useFolderContext = () => {
  const context = useContext(FolderContext);
  if (!context) {
    throw new Error("useFolderContext must be used within a FolderProvider");
  }
  return context;
};
