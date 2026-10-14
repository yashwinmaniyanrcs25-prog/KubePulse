import React, { useState } from 'react';
import {
  Network,
  Copy,
  Check,
  Play,
  RefreshCw,
  Terminal,
  Activity,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { ServiceItem, EndpointTestResponse } from '../types';
import { api } from '../services/api';

interface ServicesPageProps {
  services: ServiceItem[];
  onRefresh: () => void;
  isRefreshing: boolean;
  isConnected: boolean;
}

export const ServicesPage: React.FC<ServicesPageProps> = ({
  services,
  onRefresh,
  isRefreshing,
  isConnected,
}) => {
  const [testingEndpoint, setTestingEndpoint] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<EndpointTestResponse | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const handleTestEndpoint = async (svc: ServiceItem) => {
    setTestingEndpoint(svc.name);
    try {
      const res = await api.testServiceEndpoint(svc.name, 8000);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        url: `http://127.0.0.1:8000/health`,
        error: err.message || 'Connection failed',
      });
    } finally {
      setTestingEndpoint(null);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Network className="w-5 h-5 text-emerald-400" />
            <span>Kubernetes Services & Application Endpoints</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            ClusterIP service routing, port-forward guides, and genuine HTTP endpoint verification.
          </p>
        </div>

        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-navy-900 hover:bg-navy-800 border border-navy-700 text-xs font-medium text-slate-300 hover:text-white transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
          <span>Refresh Services</span>
        </button>
      </div>

      {!isConnected && (
        <div className="bg-navy-900 border border-red-500/40 p-4 rounded-xl flex items-center gap-3 text-xs text-red-300">
          <XCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>Kubernetes cluster is disconnected. Service records are unavailable.</span>
        </div>
      )}

      {/* Services List */}
      <div className="space-y-4">
        {services.length > 0 ? (
          services.map((svc) => {
            const portForwardCmd = `kubectl port-forward svc/${svc.name} 8000:${svc.ports[0]?.port || 80} -n ${svc.namespace}`;

            return (
              <div key={svc.name} className="glass-card p-6 border-navy-700/80">
                <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-navy-800 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                      <Network className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-white">{svc.name}</h2>
                        <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded">
                          {svc.type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        Cluster IP: {svc.cluster_ip || 'None'}
                      </p>
                    </div>
                  </div>

                  {/* Test Endpoint Button */}
                  <button
                    onClick={() => handleTestEndpoint(svc)}
                    disabled={testingEndpoint === svc.name}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 shadow-md shadow-cyan-500/10 transition-all disabled:opacity-50"
                  >
                    {testingEndpoint === svc.name ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Connecting to Endpoint...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 text-cyan-400 fill-current" />
                        <span>Test /health Endpoint</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Port Mapping & Selectors */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-4">
                  <div className="bg-navy-950/70 p-3 rounded-xl border border-navy-800">
                    <span className="text-[10px] uppercase font-mono text-slate-400">Port Mapping</span>
                    <div className="mt-1 font-mono text-xs text-slate-200">
                      {svc.ports.map((p, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>{p.name || 'http'}: {p.port} → {p.target_port}</span>
                          <span className="text-slate-400">{p.protocol}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-navy-950/70 p-3 rounded-xl border border-navy-800">
                    <span className="text-[10px] uppercase font-mono text-slate-400">Pod Selector</span>
                    <div className="mt-1 font-mono text-xs text-cyan-300">
                      {Object.entries(svc.selector).map(([k, v]) => `${k}=${v}`).join(', ') || 'None'}
                    </div>
                  </div>

                  <div className="bg-navy-950/70 p-3 rounded-xl border border-navy-800">
                    <span className="text-[10px] uppercase font-mono text-slate-400">Internal DNS</span>
                    <div className="mt-1 font-mono text-xs text-emerald-400 truncate">
                      {svc.name}.{svc.namespace}.svc.cluster.local
                    </div>
                  </div>
                </div>

                {/* Port-Forward PowerShell Helper */}
                <div className="bg-navy-950 p-3.5 rounded-xl border border-navy-800">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                      <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Access Locally via Windows PowerShell Port-Forward:</span>
                    </span>
                    <button
                      onClick={() => handleCopy(portForwardCmd, svc.name)}
                      className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-medium"
                    >
                      {copiedCmd === svc.name ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Command</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="font-mono text-xs text-slate-300 bg-black/40 p-2.5 rounded-lg overflow-x-auto select-all">
                    {portForwardCmd}
                  </pre>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-8 text-center text-xs text-slate-500 glass-card">
            {isConnected ? 'No Services found in this namespace.' : 'Services list unavailable (Cluster disconnected).'}
          </div>
        )}
      </div>

      {/* Real Endpoint Test Results Panel */}
      {testResult && (
        <div className={`glass-card p-5 border shadow-xl animate-in fade-in ${
          testResult.success ? 'border-emerald-500/40' : 'border-red-500/40'
        }`}>
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-navy-800">
            <div className="flex items-center gap-2">
              <Activity className={`w-4 h-4 ${testResult.success ? 'text-emerald-400' : 'text-red-400'}`} />
              <h3 className="text-sm font-semibold text-white">Application Health Response</h3>
              {testResult.success ? (
                <>
                  <span className="text-xs font-mono bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">
                    HTTP {testResult.status_code} OK
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    Latency: {testResult.latency_ms}ms
                  </span>
                </>
              ) : (
                <span className="text-xs font-mono bg-red-500/20 text-red-400 px-2 py-0.5 rounded">
                  Connection Failed
                </span>
              )}
            </div>
            <button
              onClick={() => setTestResult(null)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Dismiss
            </button>
          </div>

          {testResult.success ? (
            <pre className="bg-navy-950 p-4 rounded-xl text-xs font-mono text-emerald-300 overflow-x-auto border border-navy-800">
              {JSON.stringify(testResult.body, null, 2)}
            </pre>
          ) : (
            <div className="bg-navy-950 p-4 rounded-xl border border-red-500/30 text-xs font-mono space-y-2">
              <p className="text-red-300 font-semibold">{testResult.error}</p>
              <p className="text-slate-400 text-[11px]">
                Tip: Run the port-forward command in a separate PowerShell window to connect the container to your local port 8000:
              </p>
              <pre className="text-cyan-300 bg-black/40 p-2 rounded">
                kubectl port-forward svc/kubepulse-sample-service 8000:80 -n kubepulse
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
