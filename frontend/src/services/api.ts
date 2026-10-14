import {
  ClusterStatus,
  NamespaceItem,
  DeploymentItem,
  PodItem,
  ServiceItem,
  EventItem,
  ScaleResponse,
  RolloutStatus,
  MetricsResponse,
  DeletePodResponse,
  SelfHealingObservation,
  EndpointTestResponse,
  DemoStage,
  DeployInputRequest,
  DeployInputResponse,
  WebsiteMonitorItem,
  WorkloadDeleteResponse,
} from '../types';

const API_BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    let errorMsg = `HTTP Error ${res.status}`;
    try {
      const errData = await res.json();
      if (errData.detail) errorMsg = errData.detail;
      else if (errData.message) errorMsg = errData.message;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }
  return res.json();
}

export const api = {
  // Cluster & Gateway Health
  getHealth: () =>
    fetchJson<{
      status: string;
      service: string;
      k8s_connected: boolean;
      cluster_status: string;
      cluster_name: string;
    }>('/health'),
  getClusterStatus: () => fetchJson<ClusterStatus>('/cluster/status'),
  getNamespaces: () => fetchJson<NamespaceItem[]>('/namespaces'),

  // Deployments
  getDeployments: (namespace?: string) =>
    fetchJson<DeploymentItem[]>(namespace ? `/deployments?namespace=${namespace}` : '/deployments'),
  getDeployment: (name: string, namespace?: string) =>
    fetchJson<DeploymentItem>(namespace ? `/deployments/${name}?namespace=${namespace}` : `/deployments/${name}`),
  getRolloutStatus: (name: string, namespace?: string) =>
    fetchJson<RolloutStatus>(
      namespace ? `/deployments/${name}/rollout?namespace=${namespace}` : `/deployments/${name}/rollout`
    ),
  scaleDeployment: (name: string, replicas: number, namespace?: string) =>
    fetchJson<ScaleResponse>(
      namespace ? `/deployments/${name}/scale?namespace=${namespace}` : `/deployments/${name}/scale`,
      {
        method: 'PATCH',
        body: JSON.stringify({ replicas }),
      }
    ),
  getSelfHealingStatus: (name: string, deletedPod: string, namespace?: string) =>
    fetchJson<SelfHealingObservation>(
      namespace
        ? `/deployments/${name}/self-healing-status?deleted_pod=${deletedPod}&namespace=${namespace}`
        : `/deployments/${name}/self-healing-status?deleted_pod=${deletedPod}`
    ),

  // Pods
  getPods: (namespace?: string) =>
    fetchJson<PodItem[]>(namespace ? `/pods?namespace=${namespace}` : '/pods'),
  getPod: (name: string, namespace?: string) =>
    fetchJson<PodItem>(namespace ? `/pods/${name}?namespace=${namespace}` : `/pods/${name}`),
  deletePod: (name: string, namespace?: string) =>
    fetchJson<DeletePodResponse>(
      namespace ? `/pods/${name}?namespace=${namespace}` : `/pods/${name}`,
      {
        method: 'DELETE',
      }
    ),

  // Services
  getServices: (namespace?: string) =>
    fetchJson<ServiceItem[]>(namespace ? `/services?namespace=${namespace}` : '/services'),
  testServiceEndpoint: (name: string, port = 8000) =>
    fetchJson<EndpointTestResponse>(`/services/${name}/test-endpoint?port=${port}`),

  // Events
  getEvents: (namespace?: string) =>
    fetchJson<EventItem[]>(namespace ? `/events?namespace=${namespace}` : '/events'),

  // Metrics
  getMetrics: (namespace?: string) =>
    fetchJson<MetricsResponse>(namespace ? `/metrics?namespace=${namespace}` : '/metrics'),

  // Hackathon Demo Stepper
  getDemoStages: () => fetchJson<DemoStage[]>('/demo/stages'),
  runDemoStep: (stageId: number) =>
    fetchJson<DemoStage>(`/demo/run-step/${stageId}`, { method: 'POST' }),
  resetDemoStages: () => fetchJson<{ message: string }>('/demo/reset', { method: 'POST' }),

  // Application Deployment & Website Monitoring
  deployInput: (payload: DeployInputRequest) =>
    fetchJson<DeployInputResponse>('/deployments/deploy-input', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteWorkload: (name: string, namespace?: string) =>
    fetchJson<WorkloadDeleteResponse>(
      namespace ? `/deployments/${name}/workload?namespace=${namespace}` : `/deployments/${name}/workload`,
      { method: 'DELETE' }
    ),
  getMonitors: () => fetchJson<WebsiteMonitorItem[]>('/monitors'),
  checkMonitor: (name: string) =>
    fetchJson<WebsiteMonitorItem>(`/monitors/${name}/check`, { method: 'POST' }),
  deleteMonitor: (name: string) =>
    fetchJson<{ success: boolean; message: string }>(`/monitors/${name}`, { method: 'DELETE' }),
};
