import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';

/**
 * Imperative-style confirm dialog that replaces window.confirm().
 * Usage: add <ConfirmDialog {...confirmState} /> to your JSX, then call
 * openConfirm({ title, description, onConfirm }) to show it.
 *
 * Or use the useConfirm hook for convenience.
 */

export function useConfirm() {
  const [state, setState] = React.useState({ open: false, title: '', description: '', onConfirm: null });

  const openConfirm = React.useCallback(({ title, description, onConfirm, confirmLabel = 'Confirm', variant = 'danger' }) => {
    setState({ open: true, title, description, onConfirm, confirmLabel, variant });
  }, []);

  const handleConfirm = () => {
    state.onConfirm?.();
    setState(s => ({ ...s, open: false }));
  };

  const handleCancel = () => setState(s => ({ ...s, open: false }));

  const dialogProps = { ...state, onConfirm: handleConfirm, onCancel: handleCancel };

  return { openConfirm, dialogProps };
}

export function ConfirmDialog({ open, title, description, confirmLabel = 'Confirm', variant = 'danger', onConfirm, onCancel }) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onCancel?.(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <Dialog.Title className="text-base font-semibold text-gray-900 mb-2">
            {title}
          </Dialog.Title>
          {description && (
            <Dialog.Description className="text-sm text-gray-500 mb-6">
              {description}
            </Dialog.Description>
          )}
          <div className="flex justify-end gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition ${variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
