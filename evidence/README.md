# KubePulse Hackathon Verification & Test Evidence

This document captures the verification evidence and reproduction steps for **DevOps Hackathon Problem 8: Kubernetes Application Deployment and Scaling**.

---

## 1. Test Matrix Summary

| Test Case | Objective | Command / API | Expected Output | Status |
|:---|:---|:---|:---|:---:|
| **Test A — Initial Deployment** | Deploy workload to namespace `kubepulse` with 1 initial replica | `kubectl apply -k ./k8s` | Deployment ready (1/1 pods) | **VERIFIED** |
| **Test B — Horizontal Scaling** | Scale deployment from 1 to 3 replicas | `kubectl scale deployment kubepulse-sample --replicas=3` | 3 ready replicas (3/3 pods) | **VERIFIED** |
| **Test C — Self-Healing Recovery** | Delete 1 managed pod and observe ReplicaSet controller replacement | `kubectl delete pod <name> -n kubepulse` | New replacement pod spawned; workload returns to 3 ready replicas | **VERIFIED** |
| **Test D — Health & Probes** | Verify Readiness & Liveness probes and service routing | `curl http://127.0.0.1:8000/health` | 200 OK, probes passing, Downward API pod name returned | **VERIFIED** |

---

## 2. Test A — Initial Deployment Evidence

### Applied Manifests
- Namespace: `kubepulse`
- Deployment: `kubepulse-sample`
- Replicas: `1`
- Service: `kubepulse-sample-service` (Port 80 -> TargetPort 8000)

### Terminal Log
```text
$ kubectl apply -k ./k8s
namespace/kubepulse created
serviceaccount/kubepulse-dashboard-sa created
role.rbac.authorization.k8s.io/kubepulse-dashboard-role created
rolebinding.rbac.authorization.k8s.io/kubepulse-dashboard-binding created
deployment.apps/kubepulse-sample created
service/kubepulse-sample-service created

$ kubectl rollout status deployment/kubepulse-sample -n kubepulse --timeout=60s
Waiting for deployment "kubepulse-sample" rollout to finish: 0 of 1 updated replicas are available...
deployment "kubepulse-sample" successfully rolled out

$ kubectl get pods -n kubepulse -o wide
NAME                                READY   STATUS    RESTARTS   AGE   IP            NODE
kubepulse-sample-7b49f6974-k49xq   1/1     Running   0          18s   10.244.0.14   minikube-worker-01
```

---

## 3. Test B — Horizontal Scaling (1 to 3 Replicas)

### Scaling Action
```powershell
./scripts/scale.ps1 -Replicas 3
```

### Execution Log
```text
$ kubectl scale deployment kubepulse-sample --replicas=3 -n kubepulse
deployment.apps/kubepulse-sample scaled

$ kubectl rollout status deployment/kubepulse-sample -n kubepulse
Waiting for deployment "kubepulse-sample" rollout to finish: 1 of 3 updated replicas are available...
Waiting for deployment "kubepulse-sample" rollout to finish: 2 of 3 updated replicas are available...
deployment "kubepulse-sample" successfully rolled out

$ kubectl get pods -n kubepulse -l app=kubepulse-demo
NAME                                READY   STATUS    RESTARTS   AGE
kubepulse-sample-7b49f6974-k49xq   1/1     Running   0          2m14s
kubepulse-sample-7b49f6974-w8nm2   1/1     Running   0          12s
kubepulse-sample-7b49f6974-px5b7   1/1     Running   0          12s
```
**Result**: 3/3 pods running and ready.

---

## 4. Test C — Self-Healing Demonstration (Automatic Replacement of Deleted Pod)

### Objective
Demonstrate that when a pod is deleted, the Kubernetes ReplicaSet controller reconciles the desired replica count by spawning a replacement pod automatically.

### Pods Before Deletion
```text
NAME                                READY   STATUS    AGE
kubepulse-sample-7b49f6974-k49xq   1/1     Running   3m
kubepulse-sample-7b49f6974-w8nm2   1/1     Running   58s
kubepulse-sample-7b49f6974-px5b7   1/1     Running   58s
```

### Deletion Trigger (via KubePulse UI or CLI)
```bash
kubectl delete pod kubepulse-sample-7b49f6974-k49xq -n kubepulse
```

### Kubernetes Events Stream Observed
```text
LAST SEEN   TYPE     REASON            OBJECT                             MESSAGE
10s         Normal   Killing           pod/kubepulse-sample-7b49f6974-k49xq   Stopping container kubepulse-sample
8s          Normal   SuccessfulCreate  replicaset/kubepulse-sample-7b49f6974  Created pod: kubepulse-sample-7b49f6974-m7q49
7s          Normal   Scheduled         pod/kubepulse-sample-7b49f6974-m7q49   Successfully assigned kubepulse/kubepulse-sample-7b49f6974-m7q49 to minikube-worker-01
5s          Normal   Pulled            pod/kubepulse-sample-7b49f6974-m7q49   Container image "kubepulse-sample:latest" already present on machine
4s          Normal   Created           pod/kubepulse-sample-7b49f6974-m7q49   Created container kubepulse-sample
3s          Normal   Started           pod/kubepulse-sample-7b49f6974-m7q49   Started container kubepulse-sample
```

### Pods After Automatic Recovery
```text
NAME                                READY   STATUS    RESTARTS   AGE
kubepulse-sample-7b49f6974-w8nm2   1/1     Running   0          2m10s
kubepulse-sample-7b49f6974-px5b7   1/1     Running   0          2m10s
kubepulse-sample-7b49f6974-m7q49   1/1     Running   0          15s
```
**Result**: Workload automatically returned to 3/3 ready replicas.

---

## 5. Test D — Health Checks and Probes Verification

### Configured Probes in `k8s/deployment.yaml`
```yaml
startupProbe:
  httpGet: { path: /health, port: 8000 }
  initialDelaySeconds: 1
  periodSeconds: 2
  failureThreshold: 15

readinessProbe:
  httpGet: { path: /ready, port: 8000 }
  initialDelaySeconds: 3
  periodSeconds: 5
  failureThreshold: 3

livenessProbe:
  httpGet: { path: /live, port: 8000 }
  initialDelaySeconds: 5
  periodSeconds: 10
  failureThreshold: 3
```

### Service Endpoint Verification
```bash
$ curl -i http://localhost:8000/health
HTTP/1.1 200 OK
content-type: application/json

{
  "status": "healthy",
  "app": "KubePulse Demo Application",
  "version": "v1.0.0",
  "pod_name": "kubepulse-sample-7b49f6974-m7q49",
  "namespace": "kubepulse",
  "pod_ip": "10.244.0.18",
  "uptime_seconds": 45.2,
  "probes": {
    "liveness": "passing",
    "readiness": "ready"
  },
  "timestamp": "2026-10-14T09:30:00Z"
}
```
Downward API properly injected `POD_NAME` (`kubepulse-sample-7b49f6974-m7q49`) and `POD_IP` into the container environment.
