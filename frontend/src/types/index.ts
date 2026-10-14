export interface ClusterStatus {
  is_connected: boolean;
  cluster_status: 'connected' | 'disconnected';
  cluster_name: string;
  server_version?: string;
  auth_type: string;
  current_context?: string;
  node_count: number;
  active_namespace: string;
  target_deployment: string;
  reachable: boolean;
  error_details?: string;
  message: string;
  kubeconfig_path?: string;
  available_contexts?: string[];
}

export interface NamespaceItem {
  name: string;
  status: string;
  age_seconds: number;
}

export interface ProbeConfig {
  path: string;
  port: number;
  initial_delay_seconds: number;
  period_seconds: number;
  timeout_seconds: number;
  failure_threshold: number;
}

export interface PodItem {
  name: string;
  namespace: string;
  phase: 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Terminating' | 'Unknown';
  ready: boolean;
  ready_containers: string;
  restart_count: number;
  age_seconds: number;
  pod_ip?: string;
  node_name?: string;
  owning_deployment?: string;
  owning_replicaset?: string;
  liveness_probe_status: 'healthy' | 'failing' | 'not_configured';
  readiness_probe_status: 'ready' | 'not_ready' | 'not_configured';
  is_protected: boolean;
  labels: Record<string, string>;
  containers: Array<{
    name: string;
    image: string;
    ready: boolean;
    restart_count: number;
    state: string;
  }>;
  cpu_usage?: string;
  memory_usage?: string;
}

export interface DeploymentItem {
  name: string;
  namespace: string;
  desired_replicas: number;
  available_replicas: number;
  ready_replicas: number;
  updated_replicas: number;
  image: string;
  strategy: string;
  selector: Record<string, string>;
  created_at: string;
  conditions: Array<{
    type: string;
    status: string;
    reason: string;
    message: string;
  }>;
  probes: {
    readiness?: ProbeConfig;
    liveness?: ProbeConfig;
  };
}

export interface ServiceItem {
  name: string;
  namespace: string;
  type: string;
  cluster_ip?: string;
  external_ip?: string;
  ports: Array<{
    name: string;
    port: number;
    target_port: string;
    protocol: string;
  }>;
  selector: Record<string, string>;
  age_seconds: number;
  endpoint_status: string;
}

export interface EventItem {
  id: string;
  timestamp: string;
  type: 'Normal' | 'Warning';
  reason: string;
  message: string;
  object_kind: string;
  object_name: string;
  namespace: string;
  count: number;
}

export interface ScaleResponse {
  success: boolean;
  deployment_name: string;
  namespace: string;
  previous_replicas: number;
  target_replicas: number;
  status: string;
  message: string;
}

export interface RolloutStatus {
  deployment_name: string;
  namespace: string;
  desired_replicas: number;
  updated_replicas: number;
  ready_replicas: number;
  available_replicas: number;
  is_complete: boolean;
  status_message: string;
}

export interface MetricPoint {
  timestamp: string;
  desired_replicas: number;
  available_replicas: number;
  running_pods: number;
  unhealthy_pods: number;
}

export interface PodResourceUsage {
  pod_name: string;
  cpu: string;
  memory: string;
}

export interface MetricsResponse {
  metrics_available: boolean;
  metrics_source?: string;
  metrics_message?: string;
  current_desired?: number;
  current_available?: number;
  running_pods?: number;
  unhealthy_pods?: number;
  pod_resources: PodResourceUsage[];
  history: MetricPoint[];
}

export interface DeletePodResponse {
  success: boolean;
  pod_name: string;
  namespace: string;
  owning_deployment: string;
  action: string;
  message: string;
  replacement_expected: boolean;
}

export interface SelfHealingObservation {
  deleted_pod: string;
  is_deleted: boolean;
  replacement_pod?: string;
  replacement_phase?: string;
  replacement_ready?: boolean;
  desired_replicas: number;
  ready_replicas: number;
  is_recovered: boolean;
  message: string;
}

export interface EndpointTestResponse {
  success: boolean;
  url: string;
  status_code?: number;
  body?: any;
  latency_ms?: number;
  error?: string;
}

export interface DemoStage {
  stage_id: number;
  title: string;
  description: string;
  command: string;
  expected_result: string;
  actual_result?: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
}

export type NavTab = 
  | 'overview'
  | 'workloads'
  | 'pods'
  | 'services'
  | 'health'
  | 'events'
  | 'demo'
  | 'guide'
  | 'settings';
