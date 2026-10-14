import React from 'react';
import {
  ShieldCheck,
  Server,
  Layers,
  Activity,
  AlertCircle,
  Clock,
  ArrowUpRight,
  TrendingUp,
  Cpu,
  Radio,
  ExternalLink,
  XCircle,
  Terminal,
  HelpCircle,
  RefreshCw,
  Rocket,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
} from 'recharts';
import {
  ClusterStatus,
  DeploymentItem,
  PodItem,
  EventItem,
  MetricsResponse,
  NavTab,
} from '../types';

interface OverviewPageProps {
  clusterStatus: ClusterStatus | null;
  deployments: DeploymentItem[];
  pods: PodItem[];
  events: EventItem[];
  metrics: MetricsResponse | null;
  onScaleQuick: (replicas: number) => void;
  onNavigate: (tab: NavTab) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  clusterStatus,
  deployments,
  pods,
  events,
  metrics,
  onScaleQuick,
  onNavigate,
  onRefresh,
  isRefreshing,
}) => {
  const isConnected = clusterStatus?.is_connected === true;
  const targetDep = deployments.find((d) => d.name === (clusterStatus?.target_deployment || 'kubepulse-sample')) || deployments[0];

  // Derive real values strictly when connected
  const desired = isConnected && targetDep ? targetDep.desired_replicas : null;
  const ready = isConnected && targetDep ? targetDep.ready_replicas : null;
  const runningPods = isConnected ? pods.filter((p) => p.phase === 'Running').length : null;
  const unhealthyPods = isConnected ? pods.filter((p) => !p.ready).length : null;
  const healthPercent = (desired !== null && ready !== null && desired > 0)
    ? Math.min(100, Math.round((ready / desired) * 100))
    : null;

  return (
    <div className="space-y-6">
      {/* 1. Truthful Cluster Connection Banner / Disconnected Card */}
      {!isConnected ? (
        <div className="p-6 rounded-2xl bg-navy-900 border border-red-500/40 shadow-xl space-y-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 shrink-0">
              <XCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Kubernetes Cluster Disconnected</h2>
                <span className="text-[10px] font-mono font-bold bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-0.5 rounded-full uppercase">
                  Offline
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-mono">
                {clusterStatus?.error_details || 'The KubePulse backend cannot reach a local or in-cluster Kubernetes API server.'}
              </p>
              <p className="text-xs text-slate-400">
                KubePulse queries live Kubernetes API endpoints directly. To connect, provide a valid kubeconfig at <code className="text-cyan-300 font-mono text-[11px]">%USERPROFILE%\.kube\config</code> or configure the <code className="text-cyan-300 font-mono text-[11px]">KUBECONFIG_PATH</code> environment variable.
              </p>
            </div>
          </div>

          {/* Quick Diagnostics and PowerShell Verification */}
          <div className="bg-navy-950 p-4 rounded-xl border border-navy-800 text-xs font-mono space-y-2">
            <div className="flex items-center justify-between text-slate-400 font-sans font-medium">
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                <span>Diagnostic Context & Verification:</span>
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                Searched: {clusterStatus?.kubeconfig_path || '%USERPROFILE%\\.kube\\config'}
              </span>
            </div>
            <div className="text-slate-300 space-y-1 pl-2 border-l-2 border-navy-700">
              <div>kubectl config current-context  <span className="text-slate-500"># Verify active cluster context</span></div>
              <div>kubectl cluster-info            <span className="text-slate-500"># Test control plane connectivity</span></div>
              <div>kubectl get nodes               <span className="text-slate-500"># Confirm worker node status</span></div>
            </div>
            <p className="text-[11px] font-sans text-amber-400/90 pt-1">
              Note: Per hackathon rules, do not provision unapproved clusters. Connect to an authorized existing cluster or request approved credentials.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs pt-1">
            <span className="text-slate-500 italic">No mock or fabricated data is displayed while disconnected.</span>
            <div className="flex items-center gap-2">
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  className="px-3 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-700 border border-navy-700 text-slate-200 hover:text-white font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  title="Retry connecting to Kubernetes"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
                  <span>{isRefreshing ? 'Checking...' : 'Retry Connection'}</span>
                </button>
              )}
              <button
                onClick={() => onNavigate('deploy')}
                className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-medium flex items-center gap-1.5 transition-colors"
              >
                <Rocket className="w-3.5 h-3.5 text-emerald-400" />
                <span>Deploy & Monitor</span>
              </button>
              <button
                onClick={() => onNavigate('guide')}
                className="px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-medium flex items-center gap-1 transition-colors"
              >
                <span>PowerShell Setup Guide</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 text-emerald-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-white">
                  Live Kubernetes Cluster: {clusterStatus?.cluster_name}
                </span>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Connected
                </span>
                <span className="text-xs font-mono text-slate-400">
                  {clusterStatus?.server_version}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Active Context: <span className="text-slate-300 font-mono">{clusterStatus?.current_context || 'default'}</span> • Auth: <span className="text-slate-300 font-mono">{clusterStatus?.auth_type}</span> • Nodes: <span className="text-slate-300 font-mono">{clusterStatus?.node_count}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onNavigate('deploy')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Rocket className="w-3.5 h-3.5" />
              <span>Deploy App / Monitor</span>
            </button>
            <button
              onClick={() => onNavigate('demo')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-navy-950 shadow-md shadow-emerald-500/20 transition-all flex items-center gap-1.5"
            >
              <span>Run Hackathon Test Suite</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 2. Top Stat Cards Grid (Strictly derived from real responses) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Desired Replicas */}
        <div className="stat-card">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Desired</span>
            <Layers className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-bold font-mono text-white">
            {desired !== null ? desired : '—'}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">spec.replicas</p>
        </div>

        {/* Available Replicas */}
        <div className="stat-card">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Available</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold font-mono text-emerald-400">
            {ready !== null ? ready : '—'}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">status.readyReplicas</p>
        </div>

        {/* Running Pods */}
        <div className="stat-card">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Running Pods</span>
            <Server className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-bold font-mono text-white">
            {runningPods !== null ? runningPods : '—'}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">core_v1.list_pod</p>
        </div>

        {/* Unhealthy Pods */}
        <div className="stat-card">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Unhealthy</span>
            <AlertCircle className={`w-4 h-4 ${unhealthyPods && unhealthyPods > 0 ? 'text-red-400' : 'text-slate-500'}`} />
          </div>
          <p className={`text-2xl font-bold font-mono ${unhealthyPods && unhealthyPods > 0 ? 'text-red-400' : 'text-slate-400'}`}>
            {unhealthyPods !== null ? unhealthyPods : '—'}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">failing readiness</p>
        </div>

        {/* Workload Health */}
        <div className="stat-card">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Workload Health</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold font-mono text-emerald-300">
            {healthPercent !== null ? `${healthPercent}%` : '—'}
          </p>
          <div className="w-full bg-navy-800 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                healthPercent === 100 ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
              style={{ width: `${healthPercent || 0}%` }}
            />
          </div>
        </div>

        {/* Application Endpoint */}
        <div className="stat-card">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Endpoint</span>
            <ExternalLink className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-xs font-bold font-mono text-slate-300 truncate">
            {isConnected ? 'svc/kubepulse-sample' : 'Unavailable'}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {isConnected ? 'port 80:8000' : 'Cluster offline'}
          </p>
        </div>
      </div>

      {/* 3. Managed Workload Controller */}
      {isConnected && targetDep && (
        <div className="glass-card p-5 border-emerald-500/20">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">Managed Deployment</span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="text-xs text-slate-400 font-mono">{targetDep.namespace}</span>
              </div>
              <h2 className="text-lg font-bold text-white mt-1 flex items-center gap-2">
                {targetDep.name}
                <span className="text-xs font-mono text-slate-400 font-normal">({targetDep.image})</span>
              </h2>
            </div>

            {/* Scale Controls */}
            <div className="flex items-center gap-2 bg-navy-950/80 p-1.5 rounded-xl border border-navy-800">
              <span className="text-xs text-slate-400 px-2 font-medium">Scale Replicas:</span>
              <button
                onClick={() => onScaleQuick(1)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                  targetDep.desired_replicas === 1
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-navy-800'
                }`}
              >
                1 Replica
              </button>
              <button
                onClick={() => onScaleQuick(2)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                  targetDep.desired_replicas === 2
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-navy-800'
                }`}
              >
                2 Replicas
              </button>
              <button
                onClick={() => onScaleQuick(3)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                  targetDep.desired_replicas === 3
                    ? 'bg-gradient-to-r from-emerald-500/25 to-cyan-500/25 text-emerald-300 border border-emerald-400/50 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-navy-800'
                }`}
              >
                3 Replicas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Real Metrics Graphs Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pod Count Over Time */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-white">Pod Count Over Time</h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {isConnected ? 'Observed Cluster Measurements' : 'Unavailable (Disconnected)'}
            </span>
          </div>

          <div className="h-60 w-full flex items-center justify-center">
            {isConnected && metrics?.history && metrics.history.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics.history}>
                  <defs>
                    <linearGradient id="podGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                  <XAxis dataKey="timestamp" stroke="#64748B" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={10} tickLine={false} domain={[0, 'dataMax + 1']} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="stepAfter"
                    dataKey="running_pods"
                    stroke="#10B981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#podGradient)"
                    name="Running Pods"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-xs text-slate-500 space-y-1">
                <AlertCircle className="w-5 h-5 mx-auto text-slate-600 mb-1" />
                <p>No telemetry recorded yet.</p>
                <p className="text-[11px] text-slate-600">Connect to a live cluster to view real historical samples.</p>
              </div>
            )}
          </div>
        </div>

        {/* Desired vs Available Replicas */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">Desired vs Available Replicas</h3>
            </div>
            {isConnected && (
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400" /> Desired
                </span>
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" /> Available
                </span>
              </div>
            )}
          </div>

          <div className="h-60 w-full flex items-center justify-center">
            {isConnected && metrics?.history && metrics.history.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.history.slice(-8)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                  <XAxis dataKey="timestamp" stroke="#64748B" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={10} tickLine={false} domain={[0, 4]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="desired_replicas" fill="#06B6D4" radius={[4, 4, 0, 0]} name="Desired" />
                  <Bar dataKey="available_replicas" fill="#10B981" radius={[4, 4, 0, 0]} name="Available" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-xs text-slate-500 space-y-1">
                <AlertCircle className="w-5 h-5 mx-auto text-slate-600 mb-1" />
                <p>No replica telemetry available.</p>
                <p className="text-[11px] text-slate-600">Replicas are graphed as real API responses arrive.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. Real Metrics API Resource Usage or Honest Missing Notice */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span>Kubernetes Pod Resource Usage (Metrics Server)</span>
          </h3>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
            metrics?.metrics_available ? 'bg-emerald-500/20 text-emerald-400' : 'bg-navy-950 text-slate-400 border border-navy-800'
          }`}>
            Source: {metrics?.metrics_source || 'metrics.k8s.io (offline)'}
          </span>
        </div>

        {metrics?.metrics_available && metrics.pod_resources.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {metrics.pod_resources.map((res) => (
              <div key={res.pod_name} className="bg-navy-950/80 p-3 rounded-xl border border-navy-800 text-xs font-mono">
                <p className="text-slate-200 font-bold truncate mb-1">{res.pod_name}</p>
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>CPU: <span className="text-emerald-400 font-semibold">{res.cpu}</span></span>
                  <span>Memory: <span className="text-cyan-400 font-semibold">{res.memory}</span></span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-navy-950/60 p-4 rounded-xl border border-navy-800/80 text-xs text-slate-400 flex items-start gap-3">
            <HelpCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-slate-300 font-medium">Metrics API Status:</p>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                {metrics?.metrics_message || 'Metrics Server is not installed or unreachable on this cluster. Live CPU/Memory metrics are not fabricated.'}
              </p>
              <p className="text-[11px] font-mono text-cyan-400">
                To enable on Minikube: <code className="bg-black/40 px-1 py-0.5 rounded">minikube addons enable metrics-server</code>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 6. Real Pods & Real Events Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Pods List */}
        <div className="lg:col-span-2 glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-400" />
              Active Workload Pods ({pods.length})
            </h3>
            <button
              onClick={() => onNavigate('pods')}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1"
            >
              <span>Manage Pods</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {pods.length > 0 ? (
            <div className="space-y-2.5">
              {pods.map((pod) => (
                <div
                  key={pod.name}
                  className="bg-navy-950/70 p-3 rounded-xl border border-navy-800 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${
                      pod.ready ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
                    }`} />
                    <div>
                      <p className="font-mono text-xs font-semibold text-white truncate max-w-[200px] sm:max-w-xs">
                        {pod.name}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        IP: {pod.pod_ip || 'pending'} • Node: {pod.node_name || 'unassigned'} • Restarts: {pod.restart_count}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono bg-navy-800 text-slate-300 px-2 py-0.5 rounded text-[11px]">
                      {pod.ready_containers} Ready
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${
                      pod.phase === 'Running' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-cyan-500/20 text-cyan-300'
                    }`}>
                      {pod.phase}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-500">
              {isConnected
                ? "No pods found in namespace. Run 'kubectl apply -k ./k8s' to deploy the workload."
                : "No pods to display (Cluster disconnected)."}
            </div>
          )}
        </div>

        {/* Real Events Stream */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              Real Cluster Events
            </h3>
            <button
              onClick={() => onNavigate('events')}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
            >
              View all
            </button>
          </div>

          <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
            {events.length > 0 ? (
              events.slice(0, 5).map((evt) => (
                <div key={evt.id} className="text-xs border-l-2 border-cyan-500/40 pl-3 py-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">{evt.reason}</span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString() : ''}
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px] mt-0.5 leading-snug line-clamp-2">
                    {evt.message}
                  </p>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-xs text-slate-500">
                {isConnected ? 'No events recorded in this namespace.' : 'Events unavailable (disconnected).'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
