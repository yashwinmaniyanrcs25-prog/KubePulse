import React, { useState } from 'react';
import {
  Boxes,
  CheckCircle2,
  Scale,
  RefreshCw,
  XCircle,
  Rocket,
} from 'lucide-react';
import { DeploymentItem, RolloutStatus } from '../types';
import { ScaleModal } from '../components/ScaleModal';

interface WorkloadsPageProps {
  deployments: DeploymentItem[];
  rolloutStatus: RolloutStatus | null;
  onScale: (deploymentName: string, replicas: number) => Promise<void>;
  onRefresh: () => void;
  isRefreshing: boolean;
  isConnected: boolean;
  onNavigate?: (tab: any) => void;
}

export const WorkloadsPage: React.FC<WorkloadsPageProps> = ({
  deployments,
  rolloutStatus,
  onScale,
  onRefresh,
  isRefreshing,
  isConnected,
  onNavigate,
}) => {
  const [selectedForScale, setSelectedForScale] = useState<DeploymentItem | null>(null);
  const [isScaling, setIsScaling] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleOpenScale = (dep: DeploymentItem) => {
    setSelectedForScale(dep);
  };

  const handleExecuteScale = async (replicas: number) => {
    if (!selectedForScale) return;
    setIsScaling(true);
    try {
      await onScale(selectedForScale.name, replicas);
      setNotification({
        type: 'success',
        message: `Successfully requested scale to ${replicas} replicas on Kubernetes Deployment '${selectedForScale.name}'.`,
      });
      setTimeout(() => setNotification(null), 5000);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Scale operation failed',
      });
    } finally {
      setIsScaling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Boxes className="w-5 h-5 text-emerald-400" />
            <span>Kubernetes Workloads & Deployments</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage desired replica counts, observe rolling updates, and inspect workload configurations.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {onNavigate && (
            <button
              onClick={() => onNavigate('deploy')}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-xs font-semibold text-navy-950 transition-colors shadow-sm"
            >
              <Rocket className="w-3.5 h-3.5" />
              <span>Deploy New App</span>
            </button>
          )}

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-navy-900 hover:bg-navy-800 border border-navy-700 text-xs font-medium text-slate-300 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            <span>Refresh Workloads</span>
          </button>
        </div>
      </div>

      {!isConnected && (
        <div className="bg-navy-900 border border-red-500/40 p-4 rounded-xl flex items-center gap-3 text-xs text-red-300">
          <XCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>Cluster disconnected. Live Deployments are offline. Connect to an active cluster to view and scale workloads.</span>
        </div>
      )}

      {notification && (
        <div className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 animate-in fade-in ${
          notification.type === 'success'
            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
            : 'bg-red-950/40 border-red-500/40 text-red-300'
        }`}>
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notification.message}</span>
        </div>
      )}

      {/* Deployments List */}
      <div className="space-y-4">
        {deployments.length > 0 ? (
          deployments.map((dep) => {
            const isRolloutComplete = dep.ready_replicas === dep.desired_replicas;

            return (
              <div key={dep.name} className="glass-card p-6 border-navy-700/80">
                {/* Card Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-navy-800 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <Boxes className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-white">{dep.name}</h2>
                        <span className="text-[10px] font-mono bg-navy-800 text-slate-300 px-2 py-0.5 rounded border border-navy-700">
                          {dep.namespace}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">Image: {dep.image}</p>
                    </div>
                  </div>

                  {/* Scale Action Button */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleOpenScale(dep)}
                      disabled={!isConnected}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 shadow-md shadow-emerald-500/10 transition-all disabled:opacity-50"
                    >
                      <Scale className="w-4 h-4 text-emerald-400" />
                      <span>Scale Replicas</span>
                    </button>
                  </div>
                </div>

                {/* Replica State & Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 my-5">
                  <div className="bg-navy-950/70 p-3.5 rounded-xl border border-navy-800">
                    <span className="text-[11px] text-slate-400 font-medium">Desired Replicas</span>
                    <p className="text-xl font-bold font-mono text-white mt-1">{dep.desired_replicas}</p>
                    <span className="text-[10px] text-slate-400">spec.replicas</span>
                  </div>
                  <div className="bg-navy-950/70 p-3.5 rounded-xl border border-navy-800">
                    <span className="text-[11px] text-slate-400 font-medium">Ready Replicas</span>
                    <p className="text-xl font-bold font-mono text-emerald-400 mt-1">{dep.ready_replicas}</p>
                    <span className="text-[10px] text-emerald-500/80">passing probes</span>
                  </div>
                  <div className="bg-navy-950/70 p-3.5 rounded-xl border border-navy-800">
                    <span className="text-[11px] text-slate-400 font-medium">Updated Replicas</span>
                    <p className="text-xl font-bold font-mono text-cyan-400 mt-1">{dep.updated_replicas}</p>
                    <span className="text-[10px] text-slate-400">matching pod template</span>
                  </div>
                  <div className="bg-navy-950/70 p-3.5 rounded-xl border border-navy-800">
                    <span className="text-[11px] text-slate-400 font-medium">Rollout Status</span>
                    <p className="text-xs font-bold font-mono mt-2 flex items-center gap-1.5">
                      {isRolloutComplete ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Up to date</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                          <span className="text-amber-400">Reconciling</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Strategy & Probe Specs */}
                <div className="bg-navy-950/50 p-4 rounded-xl border border-navy-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Strategy:</span>
                      <span className="font-mono text-slate-200 font-medium">{dep.strategy} (maxSurge: 1, maxUnavailable: 0)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Selector:</span>
                      <span className="font-mono text-cyan-300">
                        {Object.entries(dep.selector).map(([k, v]) => `${k}=${v}`).join(', ')}
                      </span>
                    </div>
                  </div>

                  {dep.probes && (
                    <div className="pt-2 border-t border-navy-800/80 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="flex items-center gap-2 text-slate-300">
                        <span className="text-emerald-400 font-mono">Readiness Probe:</span>
                        <span className="text-slate-400">
                          GET {dep.probes.readiness?.path || '/ready'} (port {dep.probes.readiness?.port || 8000}) • delay: {dep.probes.readiness?.initial_delay_seconds || 3}s • period: {dep.probes.readiness?.period_seconds || 5}s
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-300">
                        <span className="text-cyan-400 font-mono">Liveness Probe:</span>
                        <span className="text-slate-400">
                          GET {dep.probes.liveness?.path || '/live'} (port {dep.probes.liveness?.port || 8000}) • delay: {dep.probes.liveness?.initial_delay_seconds || 5}s • period: {dep.probes.liveness?.period_seconds || 10}s
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Conditions Timeline */}
                {dep.conditions && dep.conditions.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-navy-800/80">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                      Deployment Conditions
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {dep.conditions.map((cond, idx) => (
                        <div key={idx} className="bg-navy-950/60 p-2.5 rounded-lg border border-navy-800 text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-slate-200">{cond.type}</span>
                            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                              cond.status === 'True' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                            }`}>
                              Status: {cond.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 truncate">{cond.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="p-8 text-center text-xs text-slate-500 glass-card">
            {isConnected
              ? "No Deployments found in this namespace. Apply manifests using 'kubectl apply -k ./k8s'."
              : "Deployments unavailable (Cluster disconnected)."}
          </div>
        )}
      </div>

      {/* Scale Modal Component */}
      <ScaleModal
        isOpen={!!selectedForScale}
        deployment={selectedForScale}
        isScaling={isScaling}
        onScale={handleExecuteScale}
        onClose={() => setSelectedForScale(null)}
      />
    </div>
  );
};
