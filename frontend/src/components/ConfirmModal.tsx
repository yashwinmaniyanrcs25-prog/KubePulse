import React from 'react';
import { AlertTriangle, Trash2, X, RefreshCw } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  podName: string;
  namespace: string;
  workload: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  podName,
  namespace,
  workload,
  isDeleting,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-navy-900 border border-red-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl shadow-red-950/50">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">{title}</h3>
              <p className="text-xs text-slate-400">Kubernetes Self-Healing Demonstration</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-navy-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Selected Pod Details */}
        <div className="bg-navy-950/80 rounded-xl p-3.5 border border-navy-800 space-y-2 mb-4">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Pod Name:</span>
            <span className="font-mono text-red-300 font-medium truncate max-w-[220px]">{podName}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Namespace:</span>
            <span className="font-mono text-slate-300">{namespace}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Owning Deployment:</span>
            <span className="font-mono text-cyan-300">{workload}</span>
          </div>
        </div>

        {/* Explanation */}
        <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-300 mb-6">
          <p className="font-medium text-emerald-200 mb-1">Expected Self-Healing Behavior:</p>
          <p className="text-slate-300 leading-relaxed">
            The Kubernetes ReplicaSet controller detects the replica deficit and automatically reconciles the workload by spawning a replacement pod to restore the desired replica count.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-navy-800 hover:bg-navy-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-500 shadow-lg shadow-red-600/30 transition-all disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Terminating Pod...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm & Delete Pod</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
