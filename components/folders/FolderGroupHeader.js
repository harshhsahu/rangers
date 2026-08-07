import React, { useState } from "react";
import { Folder, ChevronDown, ChevronRight } from "lucide-react";
import { useFolderContext } from "./FolderContext";

export const FolderGroupHeader = ({ folderId, folderName, count, onMoveResource }) => {
  const { collapsedGroups, toggleGroupCollapse, draggedResourceId } = useFolderContext();
  const [isDragOver, setIsDragOver] = useState(false);
  const isCollapsed = collapsedGroups[folderId];

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const resourceId = e.dataTransfer.getData("resourceId") || draggedResourceId;
    if (resourceId) {
      await onMoveResource(resourceId, folderId);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => toggleGroupCollapse(folderId)}
      className={`flex items-center justify-between px-4 py-3 bg-base-300/60 hover:bg-base-300 rounded-lg cursor-pointer transition-all duration-200 select-none border border-transparent ${
        isDragOver ? "border-primary bg-primary/10 shadow-sm scale-[1.01]" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        <Folder size={16} className="text-primary" />
        <span className="font-semibold text-sm text-base-content">{folderName}</span>
        <span className="badge badge-sm badge-ghost font-medium text-xs opacity-75">
          {count} {count === 1 ? "item" : "items"}
        </span>
      </div>
    </div>
  );
};
export default FolderGroupHeader;
