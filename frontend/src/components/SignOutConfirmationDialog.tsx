import React from 'react';
import { LogOut } from 'lucide-react';

interface SignOutConfirmationDialogProps {
  onClose: () => void;
  onConfirm: () => void;
}

export default function SignOutConfirmationDialog({ onClose, onConfirm }: SignOutConfirmationDialogProps) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900 bg-opacity-70 flex items-center justify-center">
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-sm p-6 transform transition-all">
        
        {/* Header */}
        <div className="flex items-center space-x-3 mb-4">
          <LogOut className="w-6 h-6 text-red-600" />
          <h3 className="text-lg font-semibold text-gray-900">Confirm Sign Out</h3>
        </div>

        {/* Body */}
        <p className="text-sm text-gray-500 mb-6">
          Are you sure you want to sign out? You will need to log in again to access the compliance screening tool.
        </p>

        {/* Actions */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}