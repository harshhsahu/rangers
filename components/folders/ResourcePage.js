import React from "react";
import { FolderProvider } from "./FolderContext";

export const ResourcePage = ({ children }) => {
  return (
    <FolderProvider>
      <div className="flex w-full h-full min-h-screen">{children}</div>
    </FolderProvider>
  );
};
export default ResourcePage;
