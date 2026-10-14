import React, { useState, useEffect } from 'react';
import {
  Layers,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Server,
  Info,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { PodItem, DeletePodResponse, SelfHealingObservation } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';
import { api } from '../services/api';

interface PodsPageProps {
  pods: PodItem[];
  targetDeployment: string;
  selectedNamespace: string;
  onDeletePod: (podName: string) => Promise<DeletePodResponse>;
  onRefresh: () => void;
  isRefreshing: boolean;
  isConnected: boolean;
}

export const PodsPage: React.FC<PodsPageProps> = ({
  pods,
  targetDeployment,
  selectedNamespace,
  onDeletePod,
  onRefresh,
  isRefreshing,
  isConnected,
}) => {
  const [selectedPodForDeletion, setSelectedPodForDeletion] = useState<PodItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeVictimPod, setActiveVictimPod] = useState<string | null>(null);
  const [observation, setObservation] = useState<SelfHealingObservation | null>(null);
  const [isObserving, setIsObserving] = useState(false);

  // Poll real cluster for self-healing observation when a pod was deleted
  useEffect(() => {
    if (!activeVictimPod || !isConnected) return;

    let isSubscribed = true;
    setIsObserving(true);

    const pollInterval = setInterval(async () => {
      try {
        const obs = await api.getSelfHealingStatus(targetDeployment, activeVictimPod, selectedNamespace);
        if (isSubscribed) {
          setObservation(obs);
          onRefresh(); // Refresh table
          if (obs.is_recovered) {
            setIsObserving(false);
            clearInterval(pollInterval);
          }
        }
      } catch (err) {
        console.error('Error observing self-healing:', err);
      }
    }, 2000);

    return () => {
      isSubscribed = false;
      clearInterval(pollInterval);
    };
  }, [activeVictimPod, isConnected, targetDeployment, selectedNamespace, onRefresh]);

  const handleDeleteClick = (pod: PodItem) => {
    setSelectedPodForDeletion(pod);
  };

  const handleConfirmDelete = async () => {
    if (!selectedPodForDeletion) return;
    const podName = selectedPodForDeletion.name;
    setIsDeleting(true);
    try {
      await onDeletePod(podName);
      setSelectedPodForDeletion(null);
      setActiveVictimPod(podName);
      setObservation({
        deleted_pod: podName,
        is_deleted: false,
        replacement_ready: false,
        desired_replicas: 1,
        ready_replicas: 0,
        is_recovered: false,
        message: `Deletion command issued for '${podName}'. Polling real Kubernetes ReplicaSet controller for replacement...`
      });
    } catch (err: any) {
      alert(`Could not delete pod: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-emerald-400" />
            <span>Pods & Self-Healing Recovery</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real Kubernetes pod lifecycle inspection and explicitly confirmed self-healing recovery testing.
          </p>
        </div>

        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-navy-900 hover:bg-navy-800 border border-navy-700 text-xs font-medium text-slate-300 hover:text-white transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
          <span>Refresh Pods</span>
        </button>
      </div>

      {/* Disconnected Notice if applicable */}
      {!isConnected && (
        <div className="bg-navy-900 border border-red-500/40 p-4 rounded-xl flex items-center gap-3 text-xs text-red-300">
          <XCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>Kubernetes cluster is disconnected. Live pod data and self-healing operations are unavailable until connected.</span>
        </div>
      )}

      {/* Self-Healing Explanation Banner */}
      <div className="bg-navy-900/90 border border-emerald-500/30 p-4 rounded-xl flex items-start gap-3.5">
        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
          <Info className="w-5 h-5" />
        </div>
        <div className="text-xs space-y-1">
          <p className="font-semibold text-emerald-200">How Kubernetes Self-Healing Works:</p>
          <p className="text-slate-300 leading-relaxed">
            In Kubernetes, Pods are managed by a <span className="font-mono text-cyan-300">ReplicaSet</span> controller. When a pod is deleted, the ReplicaSet observes that actual replicas &lt; desired replicas. It automatically calls the scheduler to create a healthy replacement pod to restore the desired state.
          </p>
        </div>
      </div>

      {/* Live Self-Healing Observation Card (Connected to real cluster) */}
      {observation && (
        <div className={`p-4 rounded-xl border shadow-xl space-y-3 animate-in fade-in ${
          observation.is_recovered
            ? 'border-emerald-500/40 bg-navy-900/90'
            : 'border-cyan-500/40 bg-navy-900/90'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className={`w-4 h-4 ${observation.is_recovered ? 'text-emerald-400' : 'text-cyan-400 animate-pulse'}`} />
              <span className="text-xs font-semibold text-white">Live Self-Healing Observation</span>
              <span className="text-[10px] font-mono text-slate-400">Target: {observation.deleted_pod}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                observation.is_recovered
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
              }`}>
                {observation.is_recovered ? 'Recovery Confirmed' : 'Reconciling in Cluster...'}
              </span>
              <button
                onClick={() => setObservation(null)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Dismiss
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono bg-navy-950 p-3 rounded-lg border border-navy-800">
            <div>
              <span className="text-slate-500 block text-[10px]">Target Pod Status:</span>
              <span className={observation.is_deleted ? 'text-red-400' : 'text-amber-400'}>
                {observation.is_deleted ? 'Terminated / Removed' : 'Terminating...'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Observed Replacement:</span>
              <span className="text-cyan-300 truncate block">
                {observation.replacement_pod || 'Awaiting creation...'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Deployment Ready Replicas:</span>
              <span className={observation.is_recovered ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                {observation.ready_replicas} / {observation.desired_replicas} Ready
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-300 font-mono">
            {observation.message}
          </p>
        </div>
      )}

      {/* Real Pods Table */}
      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-navy-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-400" />
            <span>Pods in Namespace '{selectedNamespace}' ({pods.length})</span>
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            Managed Deployment: {targetDeployment}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-navy-950/60 text-slate-400 uppercase font-mono text-[10px] border-b border-navy-800">
              <tr>
                <th className="py-3 px-4">Pod Name</th>
                <th className="py-3 px-4">Phase</th>
                <th className="py-3 px-4">Ready</th>
                <th className="py-3 px-4">Restarts</th>
                <th className="py-3 px-4">Pod IP</th>
                <th className="py-3 px-4">Node</th>
                <th className="py-3 px-4">Age</th>
                <th className="py-3 px-4 text-right">Self-Healing Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-800 font-mono">
              {pods.length > 0 ? (
                pods.map((pod) => {
                  const isManaged = pod.owning_deployment === targetDeployment;
                  const minutes = Math.floor(pod.age_seconds / 60);
                  const seconds = pod.age_seconds % 60;
                  const ageFormatted = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

                  return (
                    <tr key={pod.name} className="hover:bg-navy-800/40 transition-colors">
                      {/* Name & Owner */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-200">{pod.name}</div>
                        <div className="text-[10px] text-slate-400 font-normal">
                          Owner: {pod.owning_replicaset || pod.owning_deployment || 'None'}
                        </div>
                      </td>

                      {/* Phase */}
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          pod.phase === 'Running'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-cyan-500/20 text-cyan-300 animate-pulse'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            pod.phase === 'Running' ? 'bg-emerald-400' : 'bg-cyan-400'
                          }`} />
                          {pod.phase}
                        </span>
                      </td>

                      {/* Ready Containers */}
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          pod.ready
                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                            : 'bg-amber-950/60 text-amber-400 border border-amber-800/60'
                        }`}>
                          {pod.ready_containers}
                        </span>
                      </td>

                      {/* Restarts */}
                      <td className="py-3 px-4">
                        <span className={pod.restart_count > 0 ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                          {pod.restart_count}
                        </span>
                      </td>

                      {/* Pod IP */}
                      <td className="py-3 px-4 text-slate-300">
                        {pod.pod_ip || 'unassigned'}
                      </td>

                      {/* Node */}
                      <td className="py-3 px-4 text-slate-400">
                        {pod.node_name || 'unassigned'}
                      </td>

                      {/* Age */}
                      <td className="py-3 px-4 text-slate-400">
                        {ageFormatted}
                      </td>

                      {/* Action: Delete Pod for Recovery Test */}
                      <td className="py-3 px-4 text-right">
                        {isManaged && isConnected ? (
                          <button
                            onClick={() => handleDeleteClick(pod)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 shadow-sm transition-colors"
                            title="Delete this pod from Kubernetes to observe automatic replacement"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            <span>Delete for Recovery Test</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">
                            {!isConnected ? 'Offline' : 'Protected Workload'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 text-xs">
                    {isConnected
                      ? "No pods found in namespace. Run 'kubectl apply -k ./k8s' to deploy."
                      : "Pods unavailable (Cluster disconnected)."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={!!selectedPodForDeletion}
        title="Delete Pod for Recovery Test"
        podName={selectedPodForDeletion?.name || ''}
        namespace={selectedPodForDeletion?.namespace || selectedNamespace}
        workload={selectedPodForDeletion?.owning_deployment || targetDeployment}
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setSelectedPodForDeletion(null)}
      />
    </div>
  );
};
