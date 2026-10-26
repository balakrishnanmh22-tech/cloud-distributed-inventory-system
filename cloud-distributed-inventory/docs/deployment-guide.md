# Cloud Deployment & Kubernetes Orchestration Guide

This document details both local Kubernetes testing (using Minikube or Docker Desktop Kubernetes) and production-grade cloud deployment to managed Kubernetes engines (AWS EKS, Google GKE, Azure AKS, or DigitalOcean Kubernetes).

---

## 1. Local Kubernetes Deployment (Minikube / Docker Desktop)

### Step 1: Start Minikube or Enable Docker Kubernetes
```powershell
# For Minikube on Windows:
minikube start --cpus=4 --memory=6144 --driver=docker

# Enable Ingress and Metrics Server (Required for HPA)
minikube addons enable ingress
minikube addons enable metrics-server
```

### Step 2: Build and Load Docker Images
```powershell
# Build backend and frontend images
docker build -t distributed-inventory-backend:latest ./cloud-distributed-inventory/backend
docker build -t distributed-inventory-frontend:latest ./cloud-distributed-inventory/frontend

# If using Minikube, load images directly into Minikube VM
minikube image load distributed-inventory-backend:latest
minikube image load distributed-inventory-frontend:latest
```

### Step 3: Apply Kubernetes Manifests in Order
```powershell
# 1. Namespace
kubectl apply -f ./cloud-distributed-inventory/k8s/application/namespace.yaml

# 2. ConfigMaps and Secrets
kubectl apply -f ./cloud-distributed-inventory/k8s/application/configmap.yaml

# 3. MongoDB 3-Node StatefulSet and Headless Service
kubectl apply -f ./cloud-distributed-inventory/k8s/replica-set/mongo-statefulset.yaml

# 4. Wait for MongoDB StatefulSet Pods to Enter Running State
kubectl rollout status statefulset/mongo -n cloud-inventory

# 5. Initialize Replica Set
kubectl apply -f ./cloud-distributed-inventory/k8s/replica-set/mongo-init-job.yaml

# 6. Deploy Backend API and Frontend Dashboard
kubectl apply -f ./cloud-distributed-inventory/k8s/application/backend-deployment.yaml
kubectl apply -f ./cloud-distributed-inventory/k8s/application/frontend-deployment.yaml

# 7. Apply Horizontal Pod Autoscaler (HPA)
kubectl apply -f ./cloud-distributed-inventory/k8s/application/hpa.yaml
```

### Step 4: Verify Deployment Health
```powershell
# View all pods, services, and statefulsets in namespace
kubectl get all -n cloud-inventory -o wide
```

### Step 5: Access Dashboard via Port Forward or NodePort
```powershell
# Port forward frontend service to local port 3000
kubectl port-forward service/frontend-service 3000:80 -n cloud-inventory
```
Open `http://localhost:3000` in your browser.

---

## 2. Cloud Deployment Architecture (AWS EKS / GCP GKE)

```
[ Internet Users ]
       |
  (HTTPS / TLS)
       v
[ Cloud Load Balancer (AWS ALB / GCP Cloud Load Balancer) ]
       |
[ Ingress Controller (ingress-nginx) ]
       |
  +----+--------------------------------+
  |                                     |
  v                                     v
[ Frontend Service (ClusterIP) ]   [ Backend Service (ClusterIP) ]
  | (2 Replicas)                      | (2-6 Pods via HPA)
                                        |
                         +--------------+--------------+
                         |                             |
                         v                             v
               [ MongoDB Atlas (M10+) ]     [ Self-Hosted StatefulSet ]
               (Managed Multi-Region)       (EBS gp3 PersistentVolumes)
```

### Key Differences Between Local Minikube & Actual Cloud Deployment

| Feature | Local Minikube / Docker | Production Cloud Deployment |
| :--- | :--- | :--- |
| **Ingress & TLS** | Self-signed or local port-forwarding | Let's Encrypt / AWS ACM automated TLS via cert-manager |
| **Storage Class** | `hostpath` or `standard` local volumes | AWS `gp3` EBS volumes or GCP `pd-ssd` with automated snapshot backups |
| **Database Tier** | Containerized StatefulSet (`mongo:7.0`) | Dedicated managed database (MongoDB Atlas) with private VPC peering |
| **Container Registry**| Local Docker daemon images | Amazon ECR, Google Artifact Registry, or Docker Hub private repos |
| **Secrets** | Base64 Kubernetes Secrets | HashiCorp Vault or AWS Secrets Manager synced via External Secrets Operator |

---

## 3. Capacity Planning & Estimated Cost Breakdown

| Component | AWS Resource Recommendation | Monthly Cost (Est.) |
| :--- | :--- | :--- |
| **EKS Control Plane** | AWS Managed EKS Cluster | \$73.00 |
| **Worker Nodes** | 2x `t3.medium` EC2 instances (2 vCPU, 4GB RAM) | \$60.00 |
| **Persistent Storage**| 3x 20GB `gp3` EBS Volumes | \$4.80 |
| **Database (Atlas)** | MongoDB Atlas M10 (Dedicated 3-node replica set) | \$57.00 |
| **Load Balancer** | AWS Application Load Balancer (ALB) | \$18.00 |
| **Total Estimated** | **Production Grade Resilient Setup** | **~\$212.80 / month** |
