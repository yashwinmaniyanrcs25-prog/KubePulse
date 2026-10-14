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
  // Cluster
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
};
