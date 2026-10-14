import React, { useState } from 'react';
import { Layers, X, RefreshCw, CheckCircle2 } from 'lucide-react';
import { DeploymentItem } from '../types';

interface ScaleModalProps {
  isOpen: boolean;
  deployment: DeploymentItem | null;
  isScaling: boolean;
  onScale: (replicas: number) => Promise<void>;
  onClose: () => void;
}

export const ScaleModal: React.FC<ScaleModalProps> = ({
  isOpen,
  deployment,
  isScaling,
  onScale,
  onClose,
}) => {
  const [selectedCount, setSelectedCount] = useState<number>(deployment?.desired_replicas || 1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !deployment) return null;

  const handlePreset = (count: number) => {
    setSelectedCount(count);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      await onScale(selectedCount);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to scale deployment');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-navy-900 border border-emerald-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl shadow-emerald-950/40">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Scale Deployment Replicas</h3>
              <p className="text-xs text-slate-400">{deployment.name} ({deployment.namespace})</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isScaling}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-navy-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current State Summary */}
        <div className="grid grid-cols-3 gap-2.5 bg-navy-950/80 p-3 rounded-xl border border-navy-800 text-center mb-5">
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Desired</p>
            <p className="text-base font-bold text-slate-200">{deployment.desired_replicas}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Available</p>
            <p className="text-base font-bold text-emerald-400">{deployment.available_replicas}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Ready</p>
            <p className="text-base font-bold text-cyan-400">{deployment.ready_replicas}</p>
          </div>
        </div>

        {/* Scaling Presets (1, 2, 3) */}
        <div className="mb-5">
          <label className="text-xs text-slate-300 font-medium block mb-2">
            Select Replica Count (Problem 8 Benchmark):
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => handlePreset(count)}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all flex flex-col items-center gap-1 ${
                  selectedCount === count
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-lg shadow-emerald-500/10'
                    : 'bg-navy-950/60 border-navy-700/80 text-slate-400 hover:border-navy-600 hover:text-slate-200'
                }`}
              >
                <span className="text-base font-mono">{count}</span>
                <span className="text-[10px] opacity-75">{count === 1 ? 'Single (Base)' : count === 3 ? 'Target (3 Replicas)' : '2 Replicas'}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Count Slider */}
        <div className="mb-5 bg-navy-950/50 p-3 rounded-xl border border-navy-800">
          <div className="flex justify-between items-center text-xs mb-2">
            <span className="text-slate-400">Custom Slider:</span>
            <span className="font-mono text-emerald-400 font-semibold">{selectedCount} replicas</span>
          </div>
          <input
            type="range"
            min="0"
            max="6"
            value={selectedCount}
            onChange={(e) => setSelectedCount(parseInt(e.target.value, 10))}
            className="w-full accent-emerald-500 cursor-pointer"
          />
        </div>

        {errorMsg && (
          <div className="p-2.5 mb-4 rounded-lg bg-red-950/40 border border-red-500/30 text-xs text-red-300">
            {errorMsg}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isScaling}
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-navy-800 hover:bg-navy-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isScaling}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-navy-950 bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
          >
            {isScaling ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Applying Scale...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Scale to {selectedCount} Replicas</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
