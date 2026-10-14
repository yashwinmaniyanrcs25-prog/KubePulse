import React, { useState, useEffect } from 'react';
import {
  Rocket,
  GitBranch,
  Box,
  Globe,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Scale,
  Trash2,
  Server,
  Activity,
  Layers,
  ArrowRight,
} from 'lucide-react';
import {
  DeploymentItem,
  ClusterStatus,
  DeploySourceType,
  DeployInputRequest,
  DeployInputResponse,
  WebsiteMonitorItem,
} from '../types';
import { api } from '../services/api';
import { ScaleModal } from '../components/ScaleModal';

interface DeployAppPageProps {
  clusterStatus: ClusterStatus | null;
  selectedNamespace: string;
  deployments: DeploymentItem[];
  onRefresh: () => void;
  onScale: (name: string, replicas: number) => Promise<void>;
  onNavigate: (tab: any) => void;
}

export const DeployAppPage: React.FC<DeployAppPageProps> = ({
  clusterStatus,
  selectedNamespace,
  deployments,
  onRefresh,
  onScale,
  onNavigate,
}) => {
  const [sourceType, setSourceType] = useState<DeploySourceType>('image');
  const [appName, setAppName] = useState('web-service');
  const [imageRef, setImageRef] = useState('nginx:alpine');
  const [gitUrl, setGitUrl] = useState('');
  const [gitBranch, setGitBranch] = useState('main');
  const [websiteUrl, setWebsiteUrl] = useState('https://kubernetes.io');
  const [containerPort, setContainerPort] = useState(80);
  const [replicas, setReplicas] = useState(1);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
    details?: any;
  } | null>(null);

  // External Website Monitors state
  const [monitors, setMonitors] = useState<WebsiteMonitorItem[]>([]);
  const [isLoadingMonitors, setIsLoadingMonitors] = useState(false);
  const [checkingMonitor, setCheckingMonitor] = useState<string | null>(null);

  // Scale modal state
  const [scaleTarget, setScaleTarget] = useState<DeploymentItem | null>(null);
  const [isScalingModal, setIsScalingModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isConnected = clusterStatus?.is_connected === true;

  // Load monitors on mount
  const fetchMonitors = async () => {
    setIsLoadingMonitors(true);
    try {
      const data = await api.getMonitors();
      setMonitors(data);
    } catch (e) {
      console.error('Failed to load monitors:', e);
    } finally {
      setIsLoadingMonitors(false);
    }
  };

  useEffect(() => {
    fetchMonitors();
  }, []);

  const handlePresetImage = (img: string, port: number, name: string) => {
    setImageRef(img);
    setContainerPort(port);
    setAppName(name);
  };

  const handlePresetWebsite = (url: string, name: string) => {
    setWebsiteUrl(url);
    setAppName(name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMessage({ type: 'info', text: 'Processing input and verifying security guardrails...' });

    const payload: DeployInputRequest = {
      source_type: sourceType,
      app_name: appName.trim().toLowerCase(),
      container_port: Number(containerPort),
      replicas: Number(replicas),
      namespace: selectedNamespace,
    };

    if (sourceType === 'image') {
      payload.image_ref = imageRef.trim();
    } else if (sourceType === 'git') {
      payload.git_url = gitUrl.trim();
      payload.branch = gitBranch.trim() || 'main';
    } else if (sourceType === 'website') {
      payload.website_url = websiteUrl.trim();
    }

    try {
      const res: DeployInputResponse = await api.deployInput(payload);
      setStatusMessage({
        type: 'success',
        text: res.message,
        details: res,
      });

      if (sourceType === 'website') {
        await fetchMonitors();
      } else {
        await onRefresh();
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Operation failed.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckMonitor = async (name: string) => {
    setCheckingMonitor(name);
    try {
      const updated = await api.checkMonitor(name);
      setMonitors((prev) => prev.map((m) => (m.name === name ? updated : m)));
    } catch (e: any) {
      console.error('Failed to probe monitor:', e);
    } finally {
      setCheckingMonitor(null);
    }
  };

  const handleDeleteMonitor = async (name: string) => {
    try {
      await api.deleteMonitor(name);
      setMonitors((prev) => prev.filter((m) => m.name !== name));
    } catch (e: any) {
      console.error('Failed to delete monitor:', e);
    }
  };

  const handleConfirmDeleteWorkload = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.deleteWorkload(deleteTarget, selectedNamespace);
      setStatusMessage({
        type: 'success',
        text: `Successfully deleted workload '${deleteTarget}' from namespace '${selectedNamespace}'.`,
      });
      setDeleteTarget(null);
      await onRefresh();
    } catch (e: any) {
      setStatusMessage({
        type: 'error',
        text: e.message || `Failed to delete workload '${deleteTarget}'`,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-navy-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 text-emerald-400">
              <Rocket className="w-6 h-6 stroke-[2]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Deploy & Monitor</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Deploy applications from Git or Docker images to Kubernetes, or register external websites for availability monitoring.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs px-3 py-1.5 rounded-lg bg-navy-900 border border-navy-700 text-slate-300 font-mono flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            Namespace: {selectedNamespace}
          </span>
          <button
            onClick={() => {
              onRefresh();
              fetchMonitors();
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-navy-900 hover:bg-navy-800 border border-navy-700 text-xs font-medium text-slate-300 hover:text-white transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Security & Isolation Guardrail Pill Banner */}
      <div className="bg-navy-900/90 border border-navy-700/80 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="space-y-0.5">
            <span className="font-semibold text-slate-200">Strict Kubernetes Security & Resource Guardrails Enforced</span>
            <p className="text-slate-400">
              Workloads run non-root (<code className="text-emerald-300 font-mono">UID 10001</code>), with dropped Linux capabilities, CPU limits (<code className="text-cyan-300 font-mono">500m</code>), RAM limits (<code className="text-cyan-300 font-mono">512Mi</code>), and active SSRF filtering.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded text-[11px] font-mono">
            Least-Privilege RBAC
          </span>
          <span className="bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 px-2 py-0.5 rounded text-[11px] font-mono">
            Isolated Namespace
          </span>
        </div>
      </div>

      {/* Cluster Disconnected Warning (Truthful check) */}
      {!isConnected && (
        <div className="bg-navy-900 border border-amber-500/40 p-4 rounded-xl flex items-start gap-3.5 text-xs text-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-300">Kubernetes Cluster Offline</p>
            <p className="text-slate-300">
              The Kubernetes cluster is currently unreachable ({clusterStatus?.error_details || 'dial tcp refused'}).
              You can still configure <strong>External Website Availability Monitoring</strong>, but container deployment to Kubernetes requires an active cluster.
            </p>
          </div>
        </div>
      )}

      {/* Main Deployment Form */}
      <div className="bg-navy-900/80 border border-navy-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <span>1. Select Deployment or Monitoring Source</span>
        </h2>

        {/* 3 Input Mode Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Option A: Docker Image */}
          <button
            type="button"
            onClick={() => setSourceType('image')}
            className={`p-4 rounded-xl border text-left transition-all ${
              sourceType === 'image'
                ? 'bg-gradient-to-br from-emerald-500/15 to-cyan-500/10 border-emerald-400 shadow-lg shadow-emerald-950/40'
                : 'bg-navy-950/60 border-navy-800 hover:border-navy-700 text-slate-400'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`p-2 rounded-lg ${sourceType === 'image' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-navy-800 text-slate-400'}`}>
                <Box className="w-5 h-5" />
              </div>
              <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${
                sourceType === 'image' ? 'bg-emerald-400/20 text-emerald-300' : 'bg-navy-800 text-slate-500'
              }`}>
                K8s Workload
              </span>
            </div>
            <h3 className={`font-semibold text-sm ${sourceType === 'image' ? 'text-white' : 'text-slate-300'}`}>
              Existing Docker Image
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Deploy any verified OCI container image (e.g. Docker Hub, GHCR) directly to Kubernetes.
            </p>
          </button>

          {/* Option B: Git Repository */}
          <button
            type="button"
            onClick={() => setSourceType('git')}
            className={`p-4 rounded-xl border text-left transition-all ${
              sourceType === 'git'
                ? 'bg-gradient-to-br from-emerald-500/15 to-cyan-500/10 border-emerald-400 shadow-lg shadow-emerald-950/40'
                : 'bg-navy-950/60 border-navy-800 hover:border-navy-700 text-slate-400'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`p-2 rounded-lg ${sourceType === 'git' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-navy-800 text-slate-400'}`}>
                <GitBranch className="w-5 h-5" />
              </div>
              <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${
                sourceType === 'git' ? 'bg-emerald-400/20 text-emerald-300' : 'bg-navy-800 text-slate-500'
              }`}>
                Build & Deploy
              </span>
            </div>
            <h3 className={`font-semibold text-sm ${sourceType === 'git' ? 'text-white' : 'text-slate-300'}`}>
              Git Repository URL
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Clone repo in an isolated sandbox, build a secure container, and roll out to Kubernetes.
            </p>
          </button>

          {/* Option C: Public Website Monitor */}
          <button
            type="button"
            onClick={() => setSourceType('website')}
            className={`p-4 rounded-xl border text-left transition-all ${
              sourceType === 'website'
                ? 'bg-gradient-to-br from-cyan-500/15 to-blue-500/10 border-cyan-400 shadow-lg shadow-cyan-950/40'
                : 'bg-navy-950/60 border-navy-800 hover:border-navy-700 text-slate-400'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`p-2 rounded-lg ${sourceType === 'website' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-navy-800 text-slate-400'}`}>
                <Globe className="w-5 h-5" />
              </div>
              <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${
                sourceType === 'website' ? 'bg-cyan-400/20 text-cyan-300' : 'bg-navy-800 text-slate-500'
              }`}>
                Monitoring Only
              </span>
            </div>
            <h3 className={`font-semibold text-sm ${sourceType === 'website' ? 'text-white' : 'text-slate-300'}`}>
              Public Website URL
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Track live HTTP/HTTPS uptime, latency, and response codes. Not deployed to Kubernetes.
            </p>
          </button>
        </div>

        {/* Form Inputs based on selected sourceType */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* App / Workload Name */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Workload / Monitor Name <span className="text-emerald-400">*</span>
              </label>
              <input
                type="text"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                required
                pattern="^[a-z0-9]([-a-z0-9]*[a-z0-9])?$"
                placeholder="e.g. web-service"
                className="w-full px-3.5 py-2.5 rounded-lg bg-navy-950 border border-navy-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                RFC 1123 DNS label (lowercase alphanumeric and hyphens, max 63 chars).
              </p>
            </div>

            {/* Source Specific Input */}
            {sourceType === 'image' && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Docker Image Reference <span className="text-emerald-400">*</span>
                </label>
                <input
                  type="text"
                  value={imageRef}
                  onChange={(e) => setImageRef(e.target.value)}
                  required
                  placeholder="e.g. nginx:alpine or ghcr.io/org/repo:tag"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-navy-950 border border-navy-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 font-mono"
                />
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <span className="text-[10px] text-slate-400">Presets:</span>
                  <button
                    type="button"
                    onClick={() => handlePresetImage('nginx:alpine', 80, 'nginx-demo')}
                    className="text-[10px] px-2 py-0.5 rounded bg-navy-800 hover:bg-navy-700 text-slate-300 border border-navy-700"
                  >
                    nginx:alpine (port 80)
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetImage('httpd:alpine', 80, 'apache-demo')}
                    className="text-[10px] px-2 py-0.5 rounded bg-navy-800 hover:bg-navy-700 text-slate-300 border border-navy-700"
                  >
                    httpd:alpine (port 80)
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetImage('redis:alpine', 6379, 'redis-demo')}
                    className="text-[10px] px-2 py-0.5 rounded bg-navy-800 hover:bg-navy-700 text-slate-300 border border-navy-700"
                  >
                    redis:alpine (port 6379)
                  </button>
                </div>
              </div>
            )}

            {sourceType === 'git' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Git Repository URL (HTTPS) <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    type="url"
                    value={gitUrl}
                    onChange={(e) => setGitUrl(e.target.value)}
                    required
                    placeholder="https://github.com/user/my-web-app.git"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-navy-950 border border-navy-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 font-mono"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Cloned with depth=1 in an isolated build sandbox. Requires active Docker daemon.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Git Branch
                  </label>
                  <input
                    type="text"
                    value={gitBranch}
                    onChange={(e) => setGitBranch(e.target.value)}
                    placeholder="main"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-navy-950 border border-navy-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 font-mono"
                  />
                </div>
              </>
            )}

            {sourceType === 'website' && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Public Website URL (HTTP/HTTPS) <span className="text-cyan-400">*</span>
                </label>
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  required
                  placeholder="https://example.com"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-navy-950 border border-navy-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                />
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <span className="text-[10px] text-slate-400">Presets:</span>
                  <button
                    type="button"
                    onClick={() => handlePresetWebsite('https://kubernetes.io', 'k8s-docs')}
                    className="text-[10px] px-2 py-0.5 rounded bg-navy-800 hover:bg-navy-700 text-slate-300 border border-navy-700"
                  >
                    kubernetes.io
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetWebsite('https://fastapi.tiangolo.com', 'fastapi-docs')}
                    className="text-[10px] px-2 py-0.5 rounded bg-navy-800 hover:bg-navy-700 text-slate-300 border border-navy-700"
                  >
                    fastapi.tiangolo.com
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetWebsite('https://github.com', 'github-status')}
                    className="text-[10px] px-2 py-0.5 rounded bg-navy-800 hover:bg-navy-700 text-slate-300 border border-navy-700"
                  >
                    github.com
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Kubernetes Options (For Image and Git deployments) */}
          {sourceType !== 'website' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-navy-800/80">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Container Application Port
                </label>
                <input
                  type="number"
                  min="1"
                  max="65535"
                  value={containerPort}
                  onChange={(e) => setContainerPort(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-navy-950 border border-navy-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1">Exposed via ClusterIP Service on port 80.</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Initial Desired Replicas</span>
                  <span className="text-emerald-400 font-mono font-bold">{replicas}</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={replicas}
                  onChange={(e) => setReplicas(Number(e.target.value))}
                  className="w-full accent-emerald-400 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                  <span>1 replica</span>
                  <span>5 replicas</span>
                  <span>10 replicas (max)</span>
                </div>
              </div>
            </div>
          )}

          {/* Website Notice Banner */}
          {sourceType === 'website' && (
            <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-500/40 text-xs text-cyan-200 flex items-start gap-2.5">
              <Globe className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <span>
                <strong>External Availability Monitoring:</strong> KubePulse will test this URL periodically via HTTPS/HTTP probes and record response latency. <strong>It will not deploy or fabricate any Pods or Deployments on Kubernetes.</strong>
              </span>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="submit"
              disabled={isSubmitting || (sourceType !== 'website' && !isConnected)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all shadow-lg ${
                isSubmitting || (sourceType !== 'website' && !isConnected)
                  ? 'bg-navy-800 text-slate-500 cursor-not-allowed border border-navy-700'
                  : sourceType === 'website'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-cyan-500/20'
                  : 'bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-navy-950 font-semibold shadow-emerald-500/20'
              }`}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Rocket className="w-4 h-4" />
                  <span>
                    {sourceType === 'website'
                      ? 'Add Website Monitor'
                      : sourceType === 'git'
                      ? 'Build & Deploy from Git'
                      : 'Deploy to Kubernetes'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Action Status Output */}
        {statusMessage && (
          <div
            className={`mt-6 p-4 rounded-xl border text-xs animate-in fade-in space-y-2 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-200'
                : statusMessage.type === 'error'
                ? 'bg-red-950/50 border-red-500/50 text-red-200'
                : 'bg-navy-950/70 border-navy-700 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2 font-medium">
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : statusMessage.type === 'error' ? (
                <XCircle className="w-4 h-4 text-red-400 shrink-0" />
              ) : (
                <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>

            {statusMessage.details && statusMessage.details.is_deployed_to_k8s && (
              <div className="mt-2 pt-2 border-t border-emerald-500/20 flex flex-wrap items-center gap-4 text-[11px] font-mono text-emerald-300">
                <span>Deployment: <strong>{statusMessage.details.deployment_name}</strong></span>
                <span>Service: <strong>{statusMessage.details.service_name}</strong></span>
                <span>Port: <strong>{statusMessage.details.service_port}</strong></span>
                <span>Replicas: <strong>{statusMessage.details.replicas}</strong></span>
                <button
                  onClick={() => onNavigate('workloads')}
                  className="underline hover:text-white flex items-center gap-1 font-sans font-medium"
                >
                  <span>View in Workloads</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* External Website Monitors Section */}
      <div className="bg-navy-900/80 border border-navy-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <Globe className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="text-base font-semibold text-white">External Website Availability Monitors</h2>
              <p className="text-xs text-slate-400">
                Public URLs tested externally for live HTTP response, SSL health, and latency (Non-Kubernetes).
              </p>
            </div>
          </div>
          <button
            onClick={fetchMonitors}
            disabled={isLoadingMonitors}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-navy-950 border border-navy-800 hover:bg-navy-800 text-xs text-slate-300"
          >
            <RefreshCw className={`w-3 h-3 ${isLoadingMonitors ? 'animate-spin text-cyan-400' : ''}`} />
            <span>Check All</span>
          </button>
        </div>

        {monitors.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-navy-800 rounded-xl">
            No external website monitors configured. Select "Public Website URL" above to monitor an external domain.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase tracking-wider text-slate-400 bg-navy-950/60 border-b border-navy-800">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Monitor Name</th>
                  <th className="py-2.5 px-4 font-semibold">Target URL</th>
                  <th className="py-2.5 px-4 font-semibold">Status</th>
                  <th className="py-2.5 px-4 font-semibold">Latency</th>
                  <th className="py-2.5 px-4 font-semibold">Last Checked</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-800/60">
                {monitors.map((mon) => (
                  <tr key={mon.name} className="hover:bg-navy-800/40 transition-colors">
                    <td className="py-3 px-4 font-medium text-white flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${mon.is_available ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                      <span>{mon.name}</span>
                      <span className="text-[10px] font-mono bg-cyan-950/60 text-cyan-300 border border-cyan-800/40 px-1.5 py-0.5 rounded">
                        External
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-mono truncate max-w-xs">
                      <a href={mon.url} target="_blank" rel="noreferrer" className="hover:text-cyan-400 flex items-center gap-1">
                        <span>{mon.url}</span>
                        <ExternalLink className="w-3 h-3 text-slate-500" />
                      </a>
                    </td>
                    <td className="py-3 px-4">
                      {mon.is_available ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/50">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          HTTP {mon.status_code || 200}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-red-950/80 text-red-300 border border-red-800/50">
                          <XCircle className="w-3 h-3 text-red-400" />
                          {mon.error ? mon.error.substring(0, 30) : 'Offline'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {mon.latency_ms ? `${mon.latency_ms} ms` : '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {mon.last_checked ? new Date(mon.last_checked).toLocaleTimeString() : 'Never'}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => handleCheckMonitor(mon.name)}
                        disabled={checkingMonitor === mon.name}
                        title="Probe URL now"
                        className="px-2.5 py-1 rounded bg-navy-800 hover:bg-navy-700 text-slate-200 text-xs font-medium border border-navy-700 inline-flex items-center gap-1"
                      >
                        <RefreshCw className={`w-3 h-3 ${checkingMonitor === mon.name ? 'animate-spin text-cyan-400' : ''}`} />
                        <span>Ping</span>
                      </button>
                      <button
                        onClick={() => handleDeleteMonitor(mon.name)}
                        title="Delete monitor"
                        className="px-2 py-1 rounded bg-red-950/40 hover:bg-red-900/60 text-red-300 text-xs font-medium border border-red-800/40 inline-flex items-center"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Active Deployed Workloads in Namespace */}
      <div className="bg-navy-900/80 border border-navy-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-semibold text-white">Active Kubernetes Workloads</h2>
              <p className="text-xs text-slate-400">
                Deployments running inside namespace <code className="text-emerald-400 font-mono">{selectedNamespace}</code>.
              </p>
            </div>
          </div>
        </div>

        {deployments.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-navy-800 rounded-xl">
            {isConnected ? 'No active deployments in this namespace.' : 'Cluster is offline.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {deployments.map((dep) => {
              const isReady = dep.ready_replicas === dep.desired_replicas && dep.desired_replicas > 0;
              return (
                <div
                  key={dep.name}
                  className="p-4 rounded-xl bg-navy-950/70 border border-navy-800 hover:border-navy-700 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${isReady ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
                          <span>{dep.name}</span>
                        </h3>
                        <p className="text-[11px] text-slate-400 font-mono truncate max-w-xs mt-0.5">
                          {dep.image}
                        </p>
                      </div>

                      <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium border ${
                        isReady
                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60'
                          : 'bg-amber-950/80 text-amber-300 border-amber-800/60'
                      }`}>
                        {dep.ready_replicas}/{dep.desired_replicas} Ready
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-400 font-mono bg-navy-900/60 p-2.5 rounded-lg border border-navy-800">
                      <div>
                        Strategy: <span className="text-slate-200">{dep.strategy}</span>
                      </div>
                      <div>
                        Namespace: <span className="text-slate-200">{dep.namespace}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-4 mt-4 border-t border-navy-800">
                    <button
                      onClick={() => setScaleTarget(dep)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-700 text-xs font-medium text-emerald-300 border border-emerald-500/30 transition-colors"
                    >
                      <Scale className="w-3.5 h-3.5" />
                      <span>Scale Replicas</span>
                    </button>

                    <button
                      onClick={() => setDeleteTarget(dep.name)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-xs font-medium text-red-300 border border-red-800/40 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Scale Modal */}
      {scaleTarget && (
        <ScaleModal
          isOpen={!!scaleTarget}
          deployment={scaleTarget}
          isScaling={isScalingModal}
          onScale={async (newCount: number) => {
            setIsScalingModal(true);
            try {
              await onScale(scaleTarget.name, newCount);
              setScaleTarget(null);
            } finally {
              setIsScalingModal(false);
            }
          }}
          onClose={() => setScaleTarget(null)}
        />
      )}

      {/* Delete Workload Confirm Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-navy-900 border border-red-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl shadow-red-950/50 space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Delete Workload</h3>
                <p className="text-xs text-slate-400">Namespace: {selectedNamespace}</p>
              </div>
            </div>
            <p className="text-xs text-slate-300">
              Are you sure you want to delete Kubernetes Deployment <code className="text-red-300 font-mono">{deleteTarget}</code> and its associated Service? This will terminate all running pods for this application.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg bg-navy-800 hover:bg-navy-700 text-xs font-medium text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteWorkload}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white transition-colors flex items-center gap-1.5 shadow-lg shadow-red-600/20"
              >
                {isDeleting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Delete Workload</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
