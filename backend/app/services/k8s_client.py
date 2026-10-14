import os
import re
import time
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

logger = logging.getLogger("kubepulse.k8s")

try:
    import yaml
    from kubernetes import client, config
    from kubernetes.client.rest import ApiException
    from kubernetes.config.config_exception import ConfigException
    K8S_SDK_AVAILABLE = True
except ImportError:
    K8S_SDK_AVAILABLE = False
    logger.error("kubernetes or pyyaml package not installed.")

class KubernetesService:
    """
    Pure Kubernetes Integration Service.
    Every operational value originates directly from real Kubernetes API calls.
    No hardcoded demo values, mock arrays, or simulated pod states.
    """
    def __init__(
        self,
        target_namespace: str = "kubepulse",
        target_deployment: str = "kubepulse-sample",
        kubeconfig_path: Optional[str] = None,
        kubeconfig_context: Optional[str] = None
    ):
        self.target_namespace = target_namespace
        self.target_deployment = target_deployment
        self.configured_kubeconfig_path = kubeconfig_path
        self.configured_kubeconfig_context = kubeconfig_context
        
        self.is_connected = False
        self.cluster_name = "disconnected"
        self.server_version: Optional[str] = None
        self.auth_type = "none"
        self.current_context: Optional[str] = None
        self.available_contexts: List[str] = []
        self.resolved_kubeconfig_path: Optional[str] = None
        self.error_details: Optional[str] = None
        
        self.core_v1: Optional[client.CoreV1Api] = None
        self.apps_v1: Optional[client.AppsV1Api] = None
        self.custom_objects: Optional[client.CustomObjectsApi] = None
        
        # Real timestamped metrics history collected during live connection
        self.metric_history: List[Dict[str, Any]] = []
        
        # Initialize real connection
        self.connect()

    @staticmethod
    def _sanitize_error(text: str) -> str:
        """Strips tokens, passwords, bearer credentials, and client certificates from error strings."""
        if not text:
            return ""
        # Scrub Bearer tokens
        cleaned = re.sub(r'Bearer\s+[A-Za-z0-9\-_\.]+', 'Bearer [REDACTED]', text, flags=re.IGNORECASE)
        # Scrub token: ...
        cleaned = re.sub(r'token[:=]\s*["\']?[A-Za-z0-9\-_\.]+["\']?', 'token: [REDACTED]', cleaned, flags=re.IGNORECASE)
        # Scrub client-key-data: ...
        cleaned = re.sub(r'client-key-data[:=]\s*["\']?[A-Za-z0-9\+/=]+["\']?', 'client-key-data: [REDACTED]', cleaned, flags=re.IGNORECASE)
        # Scrub client-certificate-data: ...
        cleaned = re.sub(r'client-certificate-data[:=]\s*["\']?[A-Za-z0-9\+/=]+["\']?', 'client-certificate-data: [REDACTED]', cleaned, flags=re.IGNORECASE)
        # Scrub passwords
        cleaned = re.sub(r'password[:=]\s*["\']?[^\s"\'\n]+["\']?', 'password: [REDACTED]', cleaned, flags=re.IGNORECASE)
        return cleaned

    def connect(self) -> bool:
        """
        Attempts authentication via in-cluster service account or local kubeconfig.
        Verifies connectivity by pinging the Kubernetes API server.
        """
        if not K8S_SDK_AVAILABLE:
            self._set_disconnected("Python 'kubernetes' package is not installed.")
            return False

        # Reset contexts
        self.available_contexts = []

        # 1. Check for genuine In-Cluster Kubernetes environment
        # (Only attempt in-cluster config if running inside a real pod)
        is_in_cluster = bool(os.getenv("KUBERNETES_SERVICE_HOST")) and os.path.exists("/var/run/secrets/kubernetes.io/serviceaccount")
        if is_in_cluster:
            try:
                config.load_incluster_config()
                self._initialize_api_clients()
                self.auth_type = "in-cluster"
                self.cluster_name = "in-cluster-k8s"
                self.current_context = "in-cluster"
                self.resolved_kubeconfig_path = "in-cluster-serviceaccount"
                if self._verify_connection():
                    self.is_connected = True
                    self.error_details = None
                    logger.info("Successfully connected to Kubernetes via in-cluster service account")
                    return True
            except Exception as e_incluster:
                logger.debug(f"In-cluster authentication check failed: {e_incluster}")

        # 2. Resolve Kubeconfig Path
        # Precedence: Explicit constructor arg -> KUBECONFIG_PATH env -> KUBECONFIG env -> Windows default (%USERPROFILE%\.kube\config)
        raw_path = (
            self.configured_kubeconfig_path
            or os.getenv("KUBECONFIG_PATH")
            or os.getenv("KUBECONFIG")
        )
        is_explicit = bool(raw_path and raw_path.strip())

        if is_explicit:
            clean_path = raw_path.strip().split(";")[0].strip()  # Handle Windows semicolon-delimited lists
            candidate_path = os.path.abspath(os.path.expandvars(os.path.expanduser(clean_path)))
            if not os.path.isfile(candidate_path):
                self._set_disconnected(
                    f"Configured kubeconfig file not found at '{candidate_path}'. Verify that the file path exists.",
                    kubeconfig_path=candidate_path
                )
                return False
            resolved_path = candidate_path
        else:
            user_profile = os.environ.get("USERPROFILE") or os.path.expanduser("~")
            default_path = os.path.abspath(os.path.join(user_profile, ".kube", "config"))
            if not os.path.isfile(default_path):
                self._set_disconnected(
                    "No kubeconfig found at standard location (%USERPROFILE%\\.kube\\config) and no KUBECONFIG_PATH environment variable is configured. "
                    "To connect KubePulse, configure an approved Kubernetes cluster context or place your cluster's kubeconfig file at '%USERPROFILE%\\.kube\\config'.",
                    kubeconfig_path=default_path
                )
                return False
            resolved_path = default_path

        self.resolved_kubeconfig_path = resolved_path

        # 3. Check for empty or corrupted kubeconfig file
        try:
            if os.path.getsize(resolved_path) == 0:
                self._set_disconnected(
                    f"Kubeconfig file at '{resolved_path}' is empty (0 bytes). Please supply a valid Kubernetes configuration.",
                    kubeconfig_path=resolved_path
                )
                return False

            with open(resolved_path, "r", encoding="utf-8") as f:
                content = yaml.safe_load(f)

            if not isinstance(content, dict):
                self._set_disconnected(
                    f"Kubeconfig file at '{resolved_path}' does not contain a valid YAML object.",
                    kubeconfig_path=resolved_path
                )
                return False
        except yaml.YAMLError as ye:
            self._set_disconnected(
                f"Kubeconfig file at '{resolved_path}' contains corrupted or invalid YAML: {str(ye)}",
                kubeconfig_path=resolved_path
            )
            return False
        except Exception as fe:
            self._set_disconnected(
                f"Unable to read kubeconfig at '{resolved_path}': {str(fe)}",
                kubeconfig_path=resolved_path
            )
            return False

        # 4. Parse contexts & validate selected context
        try:
            contexts, active_context = config.list_kube_config_contexts(config_file=resolved_path)
            self.available_contexts = [
                c.get("name") for c in (contexts or []) if isinstance(c, dict) and c.get("name")
            ]
        except Exception as e_ctx:
            err_msg = str(e_ctx)
            if "current-context" in err_msg:
                self._set_disconnected(
                    f"No active 'current-context' is set in '{resolved_path}'. Use 'kubectl config use-context <name>' or set KUBECONFIG_CONTEXT.",
                    kubeconfig_path=resolved_path
                )
            else:
                self._set_disconnected(
                    f"Failed to inspect contexts from kubeconfig '{resolved_path}': {self._sanitize_error(err_msg)}",
                    kubeconfig_path=resolved_path
                )
            return False

        # Select target context
        requested_context = (
            self.configured_kubeconfig_context
            or os.getenv("KUBECONFIG_CONTEXT")
            or None
        )

        if requested_context:
            if requested_context not in self.available_contexts:
                avail_str = ", ".join(self.available_contexts) if self.available_contexts else "none"
                self._set_disconnected(
                    f"Requested context '{requested_context}' was not found in kubeconfig. Available contexts: [{avail_str}].",
                    kubeconfig_path=resolved_path
                )
                return False
            target_context = requested_context
        else:
            if active_context and isinstance(active_context, dict) and active_context.get("name"):
                target_context = active_context.get("name")
            elif self.available_contexts:
                self._set_disconnected(
                    f"No active 'current-context' is set in '{resolved_path}'. Use 'kubectl config use-context <name>' or set KUBECONFIG_CONTEXT.",
                    kubeconfig_path=resolved_path
                )
                return False
            else:
                self._set_disconnected(
                    f"No contexts found in kubeconfig '{resolved_path}'.",
                    kubeconfig_path=resolved_path
                )
                return False

        # 5. Load selected context
        try:
            config.load_kube_config(config_file=resolved_path, context=target_context)
            self.current_context = target_context
            self.auth_type = "kubeconfig"

            # Derive cluster name from selected context
            cluster_name = target_context
            for c in (contexts or []):
                if isinstance(c, dict) and c.get("name") == target_context:
                    ctx_inner = c.get("context", {})
                    if isinstance(ctx_inner, dict):
                        cluster_name = ctx_inner.get("cluster", target_context)
                    break
            self.cluster_name = cluster_name
            self._initialize_api_clients()
        except Exception as e_load:
            self._set_disconnected(
                f"Failed to load Kubernetes configuration for context '{target_context}': {self._sanitize_error(str(e_load))}",
                kubeconfig_path=resolved_path
            )
            return False

        # 6. Actively verify connection to real API server
        if self._verify_connection():
            self.is_connected = True
            self.error_details = None
            logger.info(f"Successfully connected to Kubernetes cluster '{self.cluster_name}' (Context: {self.current_context})")
            return True

        return False

    def _initialize_api_clients(self):
        self.core_v1 = client.CoreV1Api()
        self.apps_v1 = client.AppsV1Api()
        self.custom_objects = client.CustomObjectsApi()

    def _verify_connection(self) -> bool:
        """Pings the API server and tests access to core resources."""
        try:
            version_api = client.VersionApi()
            version_info = version_api.get_code()
            self.server_version = f"v{version_info.major}.{version_info.minor}"
            if self.core_v1:
                self.core_v1.get_api_resources()
            return True
        except ApiException as ae:
            if ae.status == 401:
                self._set_disconnected(
                    f"Authentication failed for cluster '{self.cluster_name}': Credentials or bearer token are invalid or expired (HTTP 401)."
                )
            elif ae.status == 403:
                self._set_disconnected(
                    f"Authorization failed for cluster '{self.cluster_name}': Insufficient permissions for active user/service account (HTTP 403)."
                )
            else:
                self._set_disconnected(
                    f"Kubernetes API check failed: {ae.reason or 'API Error'} (HTTP {ae.status})."
                )
            return False
        except Exception as e:
            host = "Kubernetes API server"
            if self.core_v1 and hasattr(self.core_v1, "api_client") and self.core_v1.api_client:
                cfg = getattr(self.core_v1.api_client, "configuration", None)
                if cfg and getattr(cfg, "host", None):
                    host = cfg.host

            err_str = str(e)
            if any(term in err_str for term in ["MaxRetryError", "ConnectionRefused", "ConnectTimeout", "Failed to establish a new connection"]):
                self._set_disconnected(
                    f"Cannot reach Kubernetes API server at '{host}'. Verify that the cluster is running and network is accessible."
                )
            elif any(term in err_str for term in ["SSLError", "CERTIFICATE_VERIFY_FAILED"]):
                self._set_disconnected(
                    f"TLS/SSL certificate validation failed for '{host}'. Check certificate-authority-data in kubeconfig."
                )
            else:
                self._set_disconnected(
                    f"Kubernetes API connection check failed: {self._sanitize_error(err_str)}"
                )
            return False

    def _set_disconnected(self, reason: str, kubeconfig_path: Optional[str] = None):
        self.is_connected = False
        self.cluster_name = "disconnected"
        self.server_version = None
        self.auth_type = "none"
        self.current_context = None
        self.error_details = self._sanitize_error(reason)
        if kubeconfig_path:
            self.resolved_kubeconfig_path = kubeconfig_path
        logger.warning(f"Kubernetes cluster disconnected: {self.error_details}")

    def _ensure_connected(self):
        """Raises ConnectionError if the cluster is not reachable."""
        if not self.is_connected:
            # Re-try connecting once in case a cluster just came online
            if not self.connect():
                raise ConnectionError(
                    f"Kubernetes cluster is disconnected. Error: {self.error_details or 'Unreachable API server'}"
                )

    # -------------------------------------------------------------
    # CLUSTER STATUS
    # -------------------------------------------------------------
    def get_cluster_status(self) -> Dict[str, Any]:
        """Returns truthful Kubernetes cluster connectivity status."""
        # Refresh connection state
        if not self.is_connected:
            self.connect()

        node_count = 0
        if self.is_connected and self.core_v1:
            try:
                nodes = self.core_v1.list_node(timeout_seconds=3)
                node_count = len(nodes.items)
            except Exception as e:
                logger.warning(f"Unable to read nodes: {e}")

        status_str = "connected" if self.is_connected else "disconnected"
        msg = (
            f"Connected to live cluster '{self.cluster_name}' via {self.auth_type} (Context: {self.current_context})."
            if self.is_connected
            else f"No active Kubernetes cluster connected. {self.error_details or 'Check kubeconfig or cluster status.'}"
        )

        return {
            "is_connected": self.is_connected,
            "cluster_status": status_str,
            "cluster_name": self.cluster_name if self.is_connected else "none",
            "server_version": self.server_version,
            "auth_type": self.auth_type,
            "current_context": self.current_context,
            "node_count": node_count,
            "active_namespace": self.target_namespace,
            "target_deployment": self.target_deployment,
            "reachable": self.is_connected,
            "error_details": self.error_details,
            "message": msg,
            "kubeconfig_path": self.resolved_kubeconfig_path,
            "available_contexts": self.available_contexts,
        }

    # -------------------------------------------------------------
    # NAMESPACES
    # -------------------------------------------------------------
    def list_namespaces(self) -> List[Dict[str, Any]]:
        self._ensure_connected()
        try:
            ns_list = self.core_v1.list_namespace(timeout_seconds=5)
            res = []
            now = datetime.now(timezone.utc)
            for item in ns_list.items:
                created = item.metadata.creation_timestamp
                age = int((now - created).total_seconds()) if created else 0
                res.append({
                    "name": item.metadata.name,
                    "status": item.status.phase if item.status else "Active",
                    "age_seconds": age
                })
            return res
        except ApiException as e:
            logger.error(f"Kubernetes API error listing namespaces: {e}")
            raise RuntimeError(f"Kubernetes API error: {e.reason} ({e.status})")

    # -------------------------------------------------------------
    # DEPLOYMENTS
    # -------------------------------------------------------------
    def list_deployments(self, namespace: Optional[str] = None) -> List[Dict[str, Any]]:
        self._ensure_connected()
        ns = namespace or self.target_namespace
        try:
            deps = self.apps_v1.list_namespaced_deployment(namespace=ns, timeout_seconds=5)
            result = []
            for d in deps.items:
                spec = d.spec
                status = d.status
                image = "unknown"
                if spec.template.spec.containers:
                    image = spec.template.spec.containers[0].image
                
                probes = {}
                if spec.template.spec.containers:
                    c = spec.template.spec.containers[0]
                    if c.readiness_probe and c.readiness_probe.http_get:
                        probes["readiness"] = {
                            "path": c.readiness_probe.http_get.path or "/",
                            "port": c.readiness_probe.http_get.port or 80,
                            "initial_delay_seconds": c.readiness_probe.initial_delay_seconds or 0,
                            "period_seconds": c.readiness_probe.period_seconds or 10,
                            "timeout_seconds": c.readiness_probe.timeout_seconds or 1,
                            "failure_threshold": c.readiness_probe.failure_threshold or 3
                        }
                    if c.liveness_probe and c.liveness_probe.http_get:
                        probes["liveness"] = {
                            "path": c.liveness_probe.http_get.path or "/",
                            "port": c.liveness_probe.http_get.port or 80,
                            "initial_delay_seconds": c.liveness_probe.initial_delay_seconds or 0,
                            "period_seconds": c.liveness_probe.period_seconds or 10,
                            "timeout_seconds": c.liveness_probe.timeout_seconds or 1,
                            "failure_threshold": c.liveness_probe.failure_threshold or 3
                        }

                result.append({
                    "name": d.metadata.name,
                    "namespace": d.metadata.namespace,
                    "desired_replicas": spec.replicas if spec.replicas is not None else 0,
                    "available_replicas": status.available_replicas or 0 if status else 0,
                    "ready_replicas": status.ready_replicas or 0 if status else 0,
                    "updated_replicas": status.updated_replicas or 0 if status else 0,
                    "image": image,
                    "strategy": spec.strategy.type if spec.strategy else "RollingUpdate",
                    "selector": spec.selector.match_labels if spec.selector else {},
                    "created_at": d.metadata.creation_timestamp.isoformat() if d.metadata.creation_timestamp else "",
                    "conditions": [{"type": c.type, "status": c.status, "reason": c.reason or "", "message": c.message or ""} for c in (status.conditions or [])] if status else [],
                    "probes": probes
                })
            return result
        except ApiException as e:
            logger.error(f"Kubernetes API error listing deployments: {e}")
            raise RuntimeError(f"Kubernetes API error: {e.reason} ({e.status})")

    def get_deployment(self, name: str, namespace: Optional[str] = None) -> Optional[Dict[str, Any]]:
        deps = self.list_deployments(namespace)
        for d in deps:
            if d["name"] == name:
                return d
        return None

    # -------------------------------------------------------------
    # SCALING
    # -------------------------------------------------------------
    async def scale_deployment(self, name: str, replicas: int, namespace: Optional[str] = None) -> Dict[str, Any]:
        """Updates replica count of an actual Kubernetes Deployment via scale patch."""
        self._ensure_connected()
        ns = namespace or self.target_namespace
        
        if replicas < 0 or replicas > 10:
            raise ValueError("Replica count must be between 0 and 10.")
        
        try:
            # 1. Read current scale
            current_scale = self.apps_v1.read_namespaced_deployment_scale(name=name, namespace=ns)
            prev_replicas = current_scale.spec.replicas or 0
            
            # 2. Patch scale
            body = {"spec": {"replicas": replicas}}
            scale_obj = self.apps_v1.patch_namespaced_deployment_scale(name=name, namespace=ns, body=body)
            target = scale_obj.spec.replicas

            return {
                "success": True,
                "deployment_name": name,
                "namespace": ns,
                "previous_replicas": prev_replicas,
                "target_replicas": target,
                "status": "scaling",
                "message": f"Successfully patched Kubernetes Deployment '{name}' scale to {target} replicas."
            }
        except ApiException as e:
            logger.error(f"Kubernetes API error scaling {name}: {e}")
            raise RuntimeError(f"Kubernetes API error: {e.reason} ({e.status})")

    # -------------------------------------------------------------
    # PODS
    # -------------------------------------------------------------
    def list_pods(self, namespace: Optional[str] = None) -> List[Dict[str, Any]]:
        self._ensure_connected()
        ns = namespace or self.target_namespace
        try:
            pods = self.core_v1.list_namespaced_pod(namespace=ns, timeout_seconds=5)
            res = []
            now = datetime.now(timezone.utc)
            for p in pods.items:
                age = int((now - p.metadata.creation_timestamp).total_seconds()) if p.metadata.creation_timestamp else 0
                
                # Check container statuses
                ready = False
                restart_count = 0
                containers = []
                ready_containers_count = 0
                total_containers_count = len(p.spec.containers) if p.spec.containers else 1
                
                if p.status and p.status.container_statuses:
                    for cs in p.status.container_statuses:
                        restart_count += cs.restart_count
                        if cs.ready:
                            ready_containers_count += 1
                        
                        state_str = "unknown"
                        if cs.state:
                            if cs.state.running:
                                state_str = "running"
                            elif cs.state.waiting:
                                state_str = f"waiting ({cs.state.waiting.reason or ''})"
                            elif cs.state.terminated:
                                state_str = f"terminated ({cs.state.terminated.reason or ''})"
                        
                        containers.append({
                            "name": cs.name,
                            "image": cs.image,
                            "ready": cs.ready,
                            "restart_count": cs.restart_count,
                            "state": state_str
                        })
                
                ready = (ready_containers_count == total_containers_count) and (p.status.phase == "Running")
                
                # Determine owner
                owning_deploy = None
                owning_rs = None
                if p.metadata.owner_references:
                    for owner in p.metadata.owner_references:
                        if owner.kind == "ReplicaSet":
                            owning_rs = owner.name
                            parts = owner.name.split("-")
                            if len(parts) > 1:
                                owning_deploy = "-".join(parts[:-1])
                        elif owner.kind == "Deployment":
                            owning_deploy = owner.name

                # Infer probe states from container conditions
                live_status = "not_configured"
                ready_status = "not_configured"
                if p.status and p.status.conditions:
                    for cond in p.status.conditions:
                        if cond.type == "Ready":
                            ready_status = "ready" if cond.status == "True" else "not_ready"
                        if cond.type == "ContainersReady":
                            live_status = "healthy" if cond.status == "True" else "failing"

                # Guardrail: mark protected if not owned by target deployment
                is_prot = (owning_deploy != self.target_deployment) if owning_deploy else True

                res.append({
                    "name": p.metadata.name,
                    "namespace": p.metadata.namespace,
                    "phase": p.status.phase if p.status else "Unknown",
                    "ready": ready,
                    "ready_containers": f"{ready_containers_count}/{total_containers_count}",
                    "restart_count": restart_count,
                    "age_seconds": age,
                    "pod_ip": p.status.pod_ip if p.status else None,
                    "node_name": p.spec.node_name if p.spec else None,
                    "owning_deployment": owning_deploy or self.target_deployment,
                    "owning_replicaset": owning_rs,
                    "liveness_probe_status": live_status,
                    "readiness_probe_status": ready_status,
                    "is_protected": is_prot,
                    "labels": p.metadata.labels or {},
                    "containers": containers
                })
            return res
        except ApiException as e:
            logger.error(f"Kubernetes API error listing pods: {e}")
            raise RuntimeError(f"Kubernetes API error: {e.reason} ({e.status})")

    def get_pod(self, name: str, namespace: Optional[str] = None) -> Optional[Dict[str, Any]]:
        pods = self.list_pods(namespace)
        for p in pods:
            if p["name"] == name:
                return p
        return None

    # -------------------------------------------------------------
    # POD DELETION & SELF-HEALING RECOVERY
    # -------------------------------------------------------------
    async def delete_pod_for_recovery_test(self, pod_name: str, namespace: Optional[str] = None) -> Dict[str, Any]:
        """
        Deletes a specific managed pod from Kubernetes.
        Validates ownership guardrails strictly: rejects deletion of protected or unrelated pods.
        """
        self._ensure_connected()
        ns = namespace or self.target_namespace
        
        # 1. Fetch real pod
        target_pod = self.get_pod(pod_name, ns)
        if not target_pod:
            raise ValueError(f"Pod '{pod_name}' was not found in namespace '{ns}'.")
        
        # 2. Guardrails: Verify pod belongs to intended managed workload
        if target_pod.get("is_protected", False):
            raise PermissionError(f"Pod '{pod_name}' is protected. Only pods belonging to '{self.target_deployment}' can be tested.")
        
        if target_pod.get("owning_deployment") != self.target_deployment:
            raise PermissionError(
                f"Security guardrail triggered: Pod '{pod_name}' does not belong to managed deployment '{self.target_deployment}'."
            )

        # 3. Issue genuine delete request to Kubernetes API
        try:
            self.core_v1.delete_namespaced_pod(name=pod_name, namespace=ns)
            return {
                "success": True,
                "pod_name": pod_name,
                "namespace": ns,
                "owning_deployment": self.target_deployment,
                "action": "pod_deleted",
                "message": f"Issued delete for pod '{pod_name}'. Kubernetes ReplicaSet controller will reconcile desired replica count.",
                "replacement_expected": True
            }
        except ApiException as e:
            logger.error(f"Kubernetes API error deleting pod {pod_name}: {e}")
            raise RuntimeError(f"Kubernetes API error: {e.reason} ({e.status})")

    def observe_self_healing(self, deleted_pod_name: str, namespace: Optional[str] = None) -> Dict[str, Any]:
        """
        Inspects real cluster state to observe whether Kubernetes has replaced
        the deleted pod and restored the deployment to its desired replica count.
        """
        self._ensure_connected()
        ns = namespace or self.target_namespace
        
        dep = self.get_deployment(self.target_deployment, ns)
        if not dep:
            raise ValueError(f"Deployment '{self.target_deployment}' not found.")
        
        pods = self.list_pods(ns)
        managed_pods = [p for p in pods if p.get("owning_deployment") == self.target_deployment]
        
        # Check if deleted pod is gone
        is_deleted = all(p["name"] != deleted_pod_name for p in managed_pods)
        
        # Identify replacement pod (any pod with a different name that belongs to the same ReplicaSet)
        replacement_pod = None
        for p in managed_pods:
            if p["name"] != deleted_pod_name:
                replacement_pod = p
                break

        desired = dep["desired_replicas"]
        ready = dep["ready_replicas"]
        is_recovered = (ready == desired) and (desired > 0)

        msg = (
            f"Workload fully recovered: {ready}/{desired} replicas ready in deployment '{self.target_deployment}'."
            if is_recovered
            else f"Reconciling: {ready} of {desired} replicas ready..."
        )

        return {
            "deleted_pod": deleted_pod_name,
            "is_deleted": is_deleted,
            "replacement_pod": replacement_pod["name"] if replacement_pod else None,
            "replacement_phase": replacement_pod["phase"] if replacement_pod else None,
            "replacement_ready": replacement_pod["ready"] if replacement_pod else False,
            "desired_replicas": desired,
            "ready_replicas": ready,
            "is_recovered": is_recovered,
            "message": msg
        }

    # -------------------------------------------------------------
    # SERVICES
    # -------------------------------------------------------------
    def list_services(self, namespace: Optional[str] = None) -> List[Dict[str, Any]]:
        self._ensure_connected()
        ns = namespace or self.target_namespace
        try:
            svcs = self.core_v1.list_namespaced_service(namespace=ns, timeout_seconds=5)
            res = []
            now = datetime.now(timezone.utc)
            for s in svcs.items:
                age = int((now - s.metadata.creation_timestamp).total_seconds()) if s.metadata.creation_timestamp else 0
                ports = [{"name": p.name or "http", "port": p.port, "target_port": str(p.target_port), "protocol": p.protocol} for p in (s.spec.ports or [])]
                
                # Check if external IP is provisioned
                ext_ip = None
                if s.status and s.status.load_balancer and s.status.load_balancer.ingress:
                    ext_ip = s.status.load_balancer.ingress[0].ip or s.status.load_balancer.ingress[0].hostname

                res.append({
                    "name": s.metadata.name,
                    "namespace": s.metadata.namespace,
                    "type": s.spec.type,
                    "cluster_ip": s.spec.cluster_ip,
                    "external_ip": ext_ip,
                    "ports": ports,
                    "selector": s.spec.selector or {},
                    "age_seconds": age,
                    "endpoint_status": "configured"
                })
            return res
        except ApiException as e:
            logger.error(f"Kubernetes API error listing services: {e}")
            raise RuntimeError(f"Kubernetes API error: {e.reason} ({e.status})")

    # -------------------------------------------------------------
    # EVENTS
    # -------------------------------------------------------------
    def list_events(self, namespace: Optional[str] = None) -> List[Dict[str, Any]]:
        self._ensure_connected()
        ns = namespace or self.target_namespace
        try:
            events = self.core_v1.list_namespaced_event(namespace=ns, timeout_seconds=5)
            res = []
            for e in events.items:
                ts = ""
                if e.last_timestamp:
                    ts = e.last_timestamp.isoformat()
                elif e.event_time:
                    ts = e.event_time.isoformat()
                elif e.metadata.creation_timestamp:
                    ts = e.metadata.creation_timestamp.isoformat()

                res.append({
                    "id": str(e.metadata.uid or f"evt-{e.metadata.name}"),
                    "timestamp": ts,
                    "type": e.type or "Normal",
                    "reason": e.reason or "Unknown",
                    "message": e.message or "",
                    "object_kind": e.involved_object.kind if e.involved_object else "Unknown",
                    "object_name": e.involved_object.name if e.involved_object else "Unknown",
                    "namespace": e.metadata.namespace or ns,
                    "count": e.count or 1
                })
            # Sort descending by real timestamp
            res.sort(key=lambda x: x["timestamp"], reverse=True)
            return res
        except ApiException as e:
            logger.error(f"Kubernetes API error listing events: {e}")
            raise RuntimeError(f"Kubernetes API error: {e.reason} ({e.status})")

    # -------------------------------------------------------------
    # ROLLOUT STATUS
    # -------------------------------------------------------------
    def get_rollout_status(self, name: str, namespace: Optional[str] = None) -> Dict[str, Any]:
        self._ensure_connected()
        dep = self.get_deployment(name, namespace)
        if not dep:
            return {
                "deployment_name": name,
                "namespace": namespace or self.target_namespace,
                "desired_replicas": 0,
                "updated_replicas": 0,
                "ready_replicas": 0,
                "available_replicas": 0,
                "is_complete": False,
                "status_message": f"Deployment '{name}' not found."
            }
        
        is_complete = (dep["ready_replicas"] == dep["desired_replicas"]) and (dep["updated_replicas"] >= dep["desired_replicas"])
        msg = (
            f"Deployment '{name}' successfully rolled out with {dep['ready_replicas']}/{dep['desired_replicas']} ready replicas."
            if is_complete
            else f"Waiting for deployment rollout to finish: {dep['ready_replicas']} of {dep['desired_replicas']} updated replicas are available..."
        )
        return {
            "deployment_name": name,
            "namespace": dep["namespace"],
            "desired_replicas": dep["desired_replicas"],
            "updated_replicas": dep["updated_replicas"],
            "ready_replicas": dep["ready_replicas"],
            "available_replicas": dep["available_replicas"],
            "is_complete": is_complete,
            "status_message": msg
        }

    # -------------------------------------------------------------
    # REAL RESOURCE METRICS (KUBERNETES METRICS API)
    # -------------------------------------------------------------
    def get_metrics(self, namespace: Optional[str] = None) -> Dict[str, Any]:
        """
        Fetches real pod metrics from metrics.k8s.io if available.
        Does not fabricate CPU, memory, or historical graphs.
        """
        ns = namespace or self.target_namespace
        
        if not self.is_connected:
            return {
                "metrics_available": False,
                "metrics_source": None,
                "metrics_message": "Cluster disconnected. No live metrics available.",
                "current_desired": None,
                "current_available": None,
                "running_pods": None,
                "unhealthy_pods": None,
                "pod_resources": [],
                "history": []
            }

        dep = self.get_deployment(self.target_deployment, ns)
        desired = dep["desired_replicas"] if dep else 0
        ready = dep["ready_replicas"] if dep else 0
        
        pods = self.list_pods(ns)
        running = sum(1 for p in pods if p["phase"] == "Running" and p["ready"])
        unhealthy = sum(1 for p in pods if not p["ready"])

        # Record real timestamped point in rolling history
        point = {
            "timestamp": datetime.now(timezone.utc).strftime("%H:%M:%S"),
            "desired_replicas": desired,
            "available_replicas": ready,
            "running_pods": running,
            "unhealthy_pods": unhealthy
        }
        self.metric_history.append(point)
        if len(self.metric_history) > 30:
            self.metric_history.pop(0)

        # Query metrics.k8s.io
        pod_resources = []
        metrics_available = False
        metrics_source = None
        metrics_msg = "Metrics Server (metrics.k8s.io) is not installed on this cluster. Live CPU/Memory telemetry requires metrics-server."

        try:
            metric_data = self.custom_objects.list_namespaced_custom_object(
                group="metrics.k8s.io",
                version="v1beta1",
                namespace=ns,
                plural="pods",
                timeout_seconds=3
            )
            items = metric_data.get("items", [])
            for item in items:
                pname = item.get("metadata", {}).get("name", "unknown")
                containers = item.get("containers", [])
                cpu_total = 0
                mem_total = 0
                for c in containers:
                    usage = c.get("usage", {})
                    # cpu can be in 'n' (nanocores) or 'm' (millicores)
                    c_cpu = usage.get("cpu", "0")
                    if c_cpu.endswith("n"):
                        cpu_total += int(c_cpu[:-1]) // 1_000_000
                    elif c_cpu.endswith("m"):
                        cpu_total += int(c_cpu[:-1])
                    
                    # memory in Ki or bytes
                    c_mem = usage.get("memory", "0")
                    if c_mem.endswith("Ki"):
                        mem_total += int(c_mem[:-2]) // 1024
                    elif c_mem.endswith("Mi"):
                        mem_total += int(c_mem[:-2])

                pod_resources.append({
                    "pod_name": pname,
                    "cpu": f"{cpu_total}m",
                    "memory": f"{mem_total}Mi"
                })
            
            metrics_available = True
            metrics_source = "metrics.k8s.io/v1beta1"
            metrics_msg = "Live metrics collected from Kubernetes Metrics Server."
        except Exception:
            # Metrics API not present or not installed
            pass

        return {
            "metrics_available": metrics_available,
            "metrics_source": metrics_source,
            "metrics_message": metrics_msg,
            "current_desired": desired,
            "current_available": ready,
            "running_pods": running,
            "unhealthy_pods": unhealthy,
            "pod_resources": pod_resources,
            "history": self.metric_history
        }

# Global singleton
k8s_service = KubernetesService()
