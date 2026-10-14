import React from 'react';
import { RefreshCw, CheckCircle2, AlertTriangle, Layers, XCircle } from 'lucide-react';
import { ClusterStatus, NamespaceItem } from '../types';

interface TopNavProps {
  clusterStatus: ClusterStatus | null;
  namespaces: NamespaceItem[];
  selectedNamespace: string;
  onSelectNamespace: (ns: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  lastUpdated: Date;
}

export const TopNav: React.FC<TopNavProps> = ({
  clusterStatus,
  namespaces,
  selectedNamespace,
  onSelectNamespace,
  onRefresh,
  isRefreshing,
  lastUpdated,
}) => {
  const isConnected = clusterStatus?.is_connected === true;

  return (
    <header className="h-16 bg-navy-900/90 backdrop-blur-md border-b border-navy-700/60 px-6 flex items-center justify-between z-10 shrink-0">
      {/* Left: Cluster Context & Namespace */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-navy-950/80 px-3 py-1.5 rounded-lg border border-navy-800">
          <Layers className={`w-4 h-4 ${isConnected ? 'text-cyan-400' : 'text-slate-500'}`} />
          <span className="text-xs text-slate-400">Context:</span>
          <span className="text-xs font-mono font-medium text-slate-200">
            {clusterStatus?.current_context || (isConnected ? 'active' : 'none (disconnected)')}
          </span>
        </div>

        {/* Namespace Selector */}
        <div className="flex items-center gap-2">
          <label htmlFor="ns-select" className="text-xs text-slate-400">Namespace:</label>
          <select
            id="ns-select"
            value={isConnected ? selectedNamespace : ''}
            onChange={(e) => onSelectNamespace(e.target.value)}
            disabled={!isConnected}
            className="bg-navy-950/80 border border-navy-700 text-xs font-mono text-emerald-400 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConnected && namespaces.length > 0 ? (
              namespaces.map((ns) => (
                <option key={ns.name} value={ns.name} className="bg-navy-900 text-slate-200">
                  {ns.name}
                </option>
              ))
            ) : isConnected ? (
              <option value={selectedNamespace || 'default'} className="bg-navy-900 text-slate-200">
                {selectedNamespace || 'default'}
              </option>
            ) : (
              <option value="" className="bg-navy-900 text-slate-400">
                (No namespaces — Disconnected)
              </option>
            )}
          </select>
        </div>
      </div>

      {/* Right: Truthful Cluster Status, Refresh & Timestamp */}
      <div className="flex items-center gap-3">
        {/* Kubernetes Connection Status */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${
            isConnected
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-red-500/10 text-red-400 border-red-500/30'
          }`}
        >
          {isConnected ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Cluster Connected ({clusterStatus?.server_version || 'live'})</span>
            </>
          ) : (
            <>
              <XCircle className="w-3.5 h-3.5 text-red-400" />
              <span>Cluster Disconnected</span>
            </>
          )}
        </div>

        {/* Last Updated */}
        <span className="text-[11px] font-mono text-slate-400 hidden sm:inline" title="Last successful refresh">
          Updated: {lastUpdated.toLocaleTimeString()}
        </span>

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-2 bg-navy-800 hover:bg-navy-700 border border-navy-700 text-slate-300 hover:text-white rounded-lg transition-colors disabled:opacity-50"
          title="Refresh cluster data"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
        </button>
      </div>
    </header>
  );
};
