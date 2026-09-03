import React, { useState } from "react";
import { Folder, FolderOpen, Plus, Edit2, Check, X, FileMinus, Trash2 } from "lucide-react";
import { useFolderContext } from "./FolderContext";
import InfoTooltip from "../InfoTooltip";

const TruncatedFolderText = ({ name }) => {
  const maxLength = 16;
  const isTooLong = name.length > maxLength;
  const displayName = isTooLong ? `${name.substring(0, maxLength)}...` : name;

  if (isTooLong) {
    return (
      <InfoTooltip tooltipContent={name}>
        <span className="text-sm font-medium truncate">{displayName}</span>
      </InfoTooltip>
    );
  }

  return <span className="text-sm font-medium truncate">{name}</span>;
};

export const FolderTabs = ({
  folders = [],
  resourceType,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveResource,
  showTrashTab = false,
  deletedCount = 0,
  folderCounts = {},
  variant = "stroke",
  /**
   * Agents are organised by channel rather than folders, so that page shows only
   * All and Trash. Every other resource keeps the full folder strip.
   */
  showFolders = true,
}) => {
  const { activeFolderId, setActiveFolderId, draggedResourceId } = useFolderContext();

  /**
   * "stroke" is the app-wide neo-brutalist chip (2px ink border, solid accent
   * when selected). "soft" is the quieter 1px chip the Rangers page uses, where
   * the selected chip is an accent tint rather than a solid fill.
   */
  const isSoft = variant === "soft";
  const chipBase = isSoft
    ? "flex items-center gap-[7px] px-[11px] py-[6px] cursor-pointer transition-colors shrink-0 text-[12.5px] font-semibold rounded-[9px] border"
    : "flex items-center gap-1.5 px-[13px] py-1.5 cursor-pointer transition-all duration-200 shrink-0 text-[12.5px] font-bold rounded-[9px] border-2";
  const chipTone = (selected) => {
    if (isSoft) {
      return selected ? "border-acc-line bg-acc-soft text-acc-deep" : "border-line bg-card text-soft hover:text-ink";
    }
    return selected ? "bg-acc text-acc-ink border-ink" : "bg-card hover:bg-paper text-ink border-ink";
  };
  const chipClass = (selected) => `${chipBase} ${chipTone(selected)}`;
  const iconSize = isSoft ? 14 : 15;
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFolderId, setEditingFolderId] = useState(null);
  const [editFolderName, setEditFolderName] = useState("");
  const [dragOverFolderId, setDragOverFolderId] = useState(null);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (newFolderName.trim()) {
      await onCreateFolder(newFolderName.trim());
      setNewFolderName("");
      setIsCreating(false);
    }
  };

  const handleRename = async (folderId) => {
    if (editFolderName.trim()) {
      await onRenameFolder(folderId, editFolderName.trim());
      setEditingFolderId(null);
      setEditFolderName("");
    }
  };

  const handleDragOver = (e, folderId) => {
    e.preventDefault();
    setDragOverFolderId(folderId);
  };

  const handleDragLeave = () => {
    setDragOverFolderId(null);
  };

  const handleDrop = async (e, folderId) => {
    e.preventDefault();
    setDragOverFolderId(null);
    const resourceId = e.dataTransfer.getData("resourceId") || draggedResourceId;
    if (resourceId && onMoveResource) {
      await onMoveResource(resourceId, folderId);
    }
  };

  return (
    <div className={`w-full select-none flex flex-col gap-2 pb-3 ${isSoft ? "pt-4" : "px-4 pt-1"}`}>
      <div className="flex flex-wrap items-center gap-2 py-1">
        {/* All Items Tab */}
        <div onClick={() => setActiveFolderId(null)} className={chipClass(activeFolderId === null)}>
          {activeFolderId === null ? <FolderOpen size={iconSize} /> : <Folder size={iconSize} />}
          <span>All {folderCounts.all !== undefined ? `(${folderCounts.all})` : ""}</span>
        </div>

        {/* Dynamic Folder Tabs */}
        {showFolders &&
          folders.map((folder) => {
            const isSelected = activeFolderId === folder._id;
            const isEditing = editingFolderId === folder._id;
            const isDragOver = dragOverFolderId === folder._id;

            return (
              <div
                key={folder._id}
                onClick={() => !isEditing && setActiveFolderId(folder._id)}
                onDragOver={(e) => handleDragOver(e, folder._id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, folder._id)}
                className={`group ${chipClass(isSelected)}`}
                style={{
                  borderStyle: isDragOver ? "dashed" : "solid",
                  borderWidth: isDragOver ? "2px" : "1px",
                  borderColor: isDragOver ? "var(--acc)" : isSelected ? "transparent" : undefined,
                }}
              >
                {isSelected ? (
                  <FolderOpen size={iconSize} className="shrink-0" />
                ) : (
                  <Folder size={iconSize} className="shrink-0" />
                )}
                {isEditing ? (
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      maxLength={24}
                      value={editFolderName}
                      onChange={(e) => setEditFolderName(e.target.value)}
                      onBlur={() => handleRename(folder._id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(folder._id);
                        if (e.key === "Escape") setEditingFolderId(null);
                      }}
                      className="input input-xs input-bordered w-32 text-base-content text-xs h-6 py-0 px-1"
                      autoFocus
                    />
                    <button
                      onClick={() => handleRename(folder._id)}
                      className="btn btn-square btn-xs btn-primary h-6 w-6"
                    >
                      <Check size={10} />
                    </button>
                    <button
                      onClick={() => setEditingFolderId(null)}
                      className="btn btn-square btn-xs btn-ghost h-6 w-6"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <TruncatedFolderText name={folder.name} />
                    {folderCounts[folder._id] !== undefined && (
                      <span
                        className={`text-[11px] font-semibold opacity-80 ${isSelected ? "text-primary-content" : "text-base-content/60"}`}
                      >
                        ({folderCounts[folder._id]})
                      </span>
                    )}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingFolderId(folder._id);
                          setEditFolderName(folder.name);
                        }}
                        className="btn btn-ghost btn-xs btn-circle p-0 h-5 w-5 hover:bg-base-100/30 text-current"
                        title="Rename"
                      >
                        <Edit2 size={11} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

        {/* Uncategorized Tab */}
        {showFolders && (
          <div
            onClick={() => setActiveFolderId("uncategorized")}
            className={chipClass(activeFolderId === "uncategorized")}
            onDragOver={(e) => handleDragOver(e, "uncategorized")}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, "uncategorized")}
            style={{
              borderStyle: dragOverFolderId === "uncategorized" ? "dashed" : "solid",
              borderWidth: dragOverFolderId === "uncategorized" ? "2px" : "1px",
              borderColor: dragOverFolderId === "uncategorized" ? "var(--acc)" : "transparent",
            }}
          >
            <FileMinus size={iconSize} />
            <span>
              Uncategorized {folderCounts.uncategorized !== undefined ? `(${folderCounts.uncategorized})` : ""}
            </span>
          </div>
        )}

        {/* Trash Tab (UI only) */}
        {showTrashTab && (
          <div
            onClick={() => setActiveFolderId("trash")}
            className={
              activeFolderId === "trash"
                ? `${chipBase} bg-error text-error-content ${isSoft ? "border-error" : "border-ink"}`
                : chipClass(false)
            }
            data-testid="folder-tab-trash"
          >
            <Trash2 size={iconSize} />
            <span>Trash ({deletedCount})</span>
          </div>
        )}

        {/* Inline Create Tab / Add Button at the end */}
        {showFolders &&
          (isCreating ? (
            <form
              onSubmit={handleCreate}
              className="flex items-center gap-1 bg-base-200 px-2 py-1 shrink-0 border-2 border-stroke"
            >
              <input
                type="text"
                maxLength={24}
                placeholder="Folder name..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="input input-xs input-bordered w-32 h-6 text-xs"
                autoFocus
              />
              <button type="submit" className="btn btn-square btn-xs btn-primary h-6 w-6">
                <Check size={10} />
              </button>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="btn btn-square btn-xs btn-ghost h-6 w-6"
              >
                <X size={10} />
              </button>
            </form>
          ) : (
            <button
              onClick={() => setIsCreating(true)}
              className={`${chipBase} border-dashed bg-transparent text-soft hover:text-acc ${
                isSoft ? "border-line" : "border-stroke"
              }`}
            >
              <Plus size={iconSize} />
              <span>Add Folder</span>
            </button>
          ))}
      </div>
    </div>
  );
};

export default FolderTabs;
