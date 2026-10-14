import React from 'react';
import { Settings, RefreshCw, Server, XCircle, CheckCircle2, Shield } from 'lucide-react';
import { ClusterStatus } from '../types';

interface SettingsPageProps {
  clusterStatus: ClusterStatus | null;
  pollingInterval: number;
  onSetPollingInterval: (ms: number) => void;
  onRefresh: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  clusterStatus,
  pollingInterval,
  onSetPollingInterval,
  onRefresh,
}) => {
  const isConnected = clusterStatus?.is_connected === true;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
          <Settings className="w-5 h-5 text-emerald-400" />
          <span>Dashboard & Cluster Configuration</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Inspect genuine Kubernetes connectivity diagnostics, active targets, and telemetry polling cadence.
        </p>
      </div>

      {/* Cluster Diagnostics */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-cyan-400" />
            <span>Kubernetes Cluster Diagnostics</span>
          </h2>
          <button
            onClick={onRefresh}
            className="px-3 py-1 rounded-lg bg-navy-800 hover:bg-navy-700 border border-navy-700 text-xs font-mono text-cyan-300 hover:text-white flex items-center gap-1.5 transition-colors"
            title="Retry connecting to cluster"
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
            <span>Test / Refresh</span>
          </button>
        </div>

        <div className="bg-navy-950 rounded-xl p-4 border border-navy-800 text-xs font-mono space-y-2.5 text-slate-300">
          <div className="flex justify-between items-center pb-2 border-b border-navy-800">
            <span className="text-slate-400">Connection State:</span>
            <span className={`px-2 py-0.5 rounded font-bold ${
              isConnected ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}>
              {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-400">Kubeconfig File:</span>
            <span className="text-slate-200 truncate max-w-xs" title={clusterStatus?.kubeconfig_path || '%USERPROFILE%\\.kube\\config'}>
              {clusterStatus?.kubeconfig_path || '%USERPROFILE%\\.kube\\config'}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-400">Cluster Name:</span>
            <span className="text-slate-200">{clusterStatus?.cluster_name}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-400">Active Context:</span>
            <span className="text-slate-200">{clusterStatus?.current_context || 'None'}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-400">Available Contexts:</span>
            <span className="text-slate-300 truncate max-w-xs">
              {clusterStatus?.available_contexts && clusterStatus.available_contexts.length > 0
                ? clusterStatus.available_contexts.join(', ')
                : 'None detected'}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-400">Authentication Method:</span>
            <span className="text-slate-200">{clusterStatus?.auth_type}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-400">Kubernetes Server Version:</span>
            <span className="text-slate-200">{clusterStatus?.server_version || 'N/A (Disconnected)'}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-400">Total Nodes:</span>
            <span className="text-slate-200">{clusterStatus?.node_count || 0}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-400">Target Namespace:</span>
            <span className="text-emerald-400 font-semibold">{clusterStatus?.active_namespace}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-400">Target Managed Deployment:</span>
            <span className="text-cyan-400 font-semibold">{clusterStatus?.target_deployment}</span>
          </div>

          {clusterStatus?.error_details && (
            <div className="pt-2 border-t border-navy-800">
              <span className="text-red-400 block mb-1">Diagnostic Error Details:</span>
              <p className="text-red-300 bg-red-950/40 p-2 rounded border border-red-500/30 text-[11px] leading-relaxed">
                {clusterStatus.error_details}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Telemetry Polling Rate */}
      <div className="glass-card p-6">
        <h2 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-emerald-400" />
          Live Telemetry Polling Cadence
        </h2>
        <p className="text-xs text-slate-400 mb-4">
          Frequency of automated background telemetry polling for pods, replicas, and events from the live cluster.
        </p>

        <div className="flex flex-wrap gap-3">
          {[
            { label: 'Fast (2 seconds)', ms: 2000 },
            { label: 'Normal (5 seconds)', ms: 5000 },
            { label: 'Relaxed (10 seconds)', ms: 10000 },
            { label: 'Manual Only', ms: 0 },
          ].map((rate) => (
            <button
              key={rate.ms}
              onClick={() => onSetPollingInterval(rate.ms)}
              className={`px-3.5 py-2 rounded-xl text-xs font-mono transition-all ${
                pollingInterval === rate.ms
                  ? 'bg-emerald-500/20 border border-emerald-400 text-emerald-300 font-semibold shadow-sm'
                  : 'bg-navy-950 border border-navy-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {rate.label}
            </button>
          ))}
        </div>
      </div>

      {/* Security Statement */}
      <div className="glass-card p-6 border-navy-700/80">
        <h2 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          Security & Access Architecture
        </h2>
        <p className="text-xs text-slate-300 leading-relaxed mb-3">
          Kubernetes credentials, kubeconfig files, and bearer tokens are strictly isolated on the backend server. The browser frontend communicates exclusively via sanitized REST endpoints with least-privilege RBAC.
        </p>
        <div className="text-[11px] font-mono text-slate-400 space-y-1">
          <div>• Role: Scoped to namespace '{clusterStatus?.active_namespace || 'kubepulse'}'</div>
          <div>• Permissions: deployments, pods, services, events (No cluster-admin)</div>
          <div>• Guardrails: Deletion restricted to '{clusterStatus?.target_deployment || 'kubepulse-sample'}'</div>
        </div>
      </div>
    </div>
  );
};
