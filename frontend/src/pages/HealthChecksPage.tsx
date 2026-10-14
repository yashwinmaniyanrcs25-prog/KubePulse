import React from 'react';
import {
  Activity,
  HeartPulse,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Info,
  XCircle,
} from 'lucide-react';
import { PodItem, DeploymentItem, EventItem } from '../types';

interface HealthChecksPageProps {
  pods: PodItem[];
  deployment: DeploymentItem | null;
  events: EventItem[];
  onRefresh: () => void;
  isRefreshing: boolean;
  isConnected: boolean;
}

export const HealthChecksPage: React.FC<HealthChecksPageProps> = ({
  pods,
  deployment,
  events,
  onRefresh,
  isRefreshing,
  isConnected,
}) => {
  const probes = deployment?.probes;

  // Filter actual probe-related events from live cluster event stream
  const probeEvents = events.filter((e) =>
    ['Unhealthy', 'Killing', 'BackOff', 'FailedCreatePodSandBox', 'FailedMount'].includes(e.reason)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-emerald-400" />
            <span>Readiness & Liveness Probes Specification</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Actual probe definitions parsed from live Deployment manifests and real observed container health conditions.
          </p>
        </div>

        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-navy-900 hover:bg-navy-800 border border-navy-700 text-xs font-medium text-slate-300 hover:text-white transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
          <span>Refresh Probe States</span>
        </button>
      </div>

      {!isConnected && (
        <div className="bg-navy-900 border border-red-500/40 p-4 rounded-xl flex items-center gap-3 text-xs text-red-300">
          <XCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>Cluster disconnected. Probe configurations and container health telemetry are offline.</span>
        </div>
      )}

      {/* Educational Distinction Card: Liveness vs Readiness vs Deployment Reconciliation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Readiness Probe Card */}
        <div className="glass-card p-5 border-emerald-500/30">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <HeartPulse className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Readiness Probe</h3>
              <p className="text-[11px] text-emerald-400">Controls Service Traffic Routing</p>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Determines whether a container is ready to accept incoming client requests. If the readiness probe fails, Kubernetes stops sending network traffic to this pod by removing its IP from the Service endpoints. The container is <strong>NOT restarted</strong>.
          </p>
          <div className="mt-4 p-3 bg-navy-950/80 rounded-lg border border-navy-800 text-[11px] font-mono space-y-1 text-slate-300">
            <div>Path: <span className="text-emerald-400">{probes?.readiness?.path || 'Not defined in spec'}</span></div>
            <div>Port: {probes?.readiness?.port || '—'}</div>
            <div>Initial Delay: {probes?.readiness?.initial_delay_seconds || 0}s • Period: {probes?.readiness?.period_seconds || 0}s</div>
            <div>Failure Threshold: {probes?.readiness?.failure_threshold || 0} consecutive failures</div>
          </div>
        </div>

        {/* Liveness Probe Card */}
        <div className="glass-card p-5 border-cyan-500/30">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Liveness Probe</h3>
              <p className="text-[11px] text-cyan-400">Controls Container In-Place Restarts</p>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Detects deadlocks or crashed processes. If the liveness probe fails beyond the failure threshold, the kubelet kills the failed container and triggers an <strong>in-place container restart</strong> (incrementing <code className="text-cyan-300 font-mono">restart_count</code>).
          </p>
          <div className="mt-4 p-3 bg-navy-950/80 rounded-lg border border-navy-800 text-[11px] font-mono space-y-1 text-slate-300">
            <div>Path: <span className="text-cyan-400">{probes?.liveness?.path || 'Not defined in spec'}</span></div>
            <div>Port: {probes?.liveness?.port || '—'}</div>
            <div>Initial Delay: {probes?.liveness?.initial_delay_seconds || 0}s • Period: {probes?.liveness?.period_seconds || 0}s</div>
            <div>Failure Threshold: {probes?.liveness?.failure_threshold || 0} consecutive failures</div>
          </div>
        </div>
      </div>

      {/* Critical Distinction Banner */}
      <div className="bg-navy-900/90 border border-navy-700/80 p-4 rounded-xl flex items-start gap-3">
        <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 leading-relaxed">
          <strong className="text-white">Crucial DevOps Distinction:</strong>
          <ul className="list-disc list-inside mt-1 space-y-0.5 text-slate-400">
            <li><strong>Liveness Probe Failure:</strong> Container is killed and restarted in-place by kubelet. Pod identity and IP remain unchanged; <code className="text-cyan-300 font-mono">restart_count</code> increases.</li>
            <li><strong>Readiness Probe Failure:</strong> Pod stops receiving traffic from Service endpoints; no restart occurs.</li>
            <li><strong>Pod Deletion:</strong> Pod is destroyed completely. ReplicaSet controller detects replica shortfall and creates a brand-new replacement pod with a new name and IP.</li>
          </ul>
        </div>
      </div>

      {/* Actual Observed Pods Probe Condition Matrix */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <HeartPulse className="w-4 h-4 text-emerald-400" />
          <span>Real Observed Pod Health & Conditions ({pods.length} Pods)</span>
        </h3>

        {pods.length > 0 ? (
          <div className="space-y-3">
            {pods.map((pod) => (
              <div
                key={pod.name}
                className="bg-navy-950/70 p-4 rounded-xl border border-navy-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className={`h-2.5 w-2.5 rounded-full ${pod.ready ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
                    <span className="font-mono text-xs font-bold text-white">{pod.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400 mt-1">
                    <span>Phase: {pod.phase}</span>
                    <span>Restarts: {pod.restart_count}</span>
                    <span>Containers Ready: {pod.ready_containers}</span>
                  </div>
                </div>

                {/* Status Indicators */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-900 border border-navy-700 text-xs font-mono">
                    <span className="text-slate-400">Readiness:</span>
                    <span className={pod.readiness_probe_status === 'ready' ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>
                      {pod.readiness_probe_status}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-900 border border-navy-700 text-xs font-mono">
                    <span className="text-slate-400">ContainersReady:</span>
                    <span className={pod.liveness_probe_status === 'healthy' ? 'text-emerald-400 font-semibold' : 'text-red-400'}>
                      {pod.liveness_probe_status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-slate-500">
            {isConnected ? 'No pods found in namespace.' : 'Pods unavailable (Cluster disconnected).'}
          </div>
        )}
      </div>

      {/* Observed Probe Events */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span>Observed Probe & Health Events in Cluster</span>
        </h3>

        {probeEvents.length > 0 ? (
          <div className="space-y-2">
            {probeEvents.map((evt) => (
              <div key={evt.id} className="bg-navy-950/80 p-3 rounded-lg border border-navy-800 text-xs font-mono">
                <div className="flex justify-between text-slate-400 mb-1">
                  <span className="text-amber-400 font-bold">{evt.reason} ({evt.object_kind}: {evt.object_name})</span>
                  <span>{new Date(evt.timestamp).toLocaleTimeString()}</span>
                </div>
                <p className="text-slate-300">{evt.message}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 font-mono">
            {isConnected ? 'No probe failure events observed in this namespace. All containers healthy.' : 'Event stream unavailable.'}
          </p>
        )}
      </div>
    </div>
  );
};
