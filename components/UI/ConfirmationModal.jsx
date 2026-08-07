"use client";
import React from "react";
import Modal from "./Modal";

/**
 * A reusable confirmation modal component that displays above all other UI elements
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Controls modal visibility
 * @param {Function} props.onClose - Function called when modal is closed
 * @param {Function} props.onConfirm - Function called when primary action button is clicked
 * @param {Function} props.onCancel - Function called when cancel button is clicked (defaults to onClose)
 * @param {string} props.title - Modal title
 * @param {string|React.ReactNode} props.message - Modal content/message
 * @param {string} props.confirmText - Text for confirm button (default: "Confirm")
 * @param {string} props.cancelText - Text for cancel button (default: "Cancel")
 * @param {string} props.confirmButtonClass - Additional classes for confirm button
 * @param {React.ReactNode} props.icon - Optional icon to display next to title
 * @param {string} props.iconClass - Class for the icon wrapper
 */
const ConfirmationModal = ({
  onConfirm,
  onCancel,
  onClose,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmButtonClass = "btn-primary",
  cancelButtonClass = "",
  icon,
  iconClass = "bg-warning/20 text-warning",
  modalType,
}) => {
  const handleCancel = onCancel;
  const handleClose = onClose || onCancel;

  const footer = (
    <div className="flex justify-end gap-2">
      <button
        data-testid="confirmation-modal-cancel-button"
        id="confirmation-modal-cancel-button"
        className={`btn btn-sm ${cancelButtonClass}`}
        onClick={handleCancel}
      >
        {cancelText}
      </button>

      <button
        data-testid="confirmation-modal-confirm-button"
        id="confirmation-modal-confirm-button"
        className={`btn btn-sm ${confirmButtonClass}`}
        onClick={onConfirm}
      >
        {confirmText}
      </button>
    </div>
  );

  const modalIcon = icon ? <div className={`p-2 rounded-full ${iconClass}`}>{icon}</div> : null;

  return (
    <Modal
      MODAL_ID={modalType}
      onClose={handleClose}
      title={title}
      icon={modalIcon}
      footer={footer}
      widthClass="w-[min(448px,92vw)]"
    >
      <div className="text-base-content">{typeof message === "string" ? <p>{message}</p> : message}</div>
    </Modal>
  );
};

export default ConfirmationModal;
