# GitOps Workshop — FluxCD on Minikube

Hands-on workshop where you deploy a tiny 2-tier app (`space-app`) to a local
Minikube cluster and let **FluxCD** reconcile it from Git. You'll see
chart-version bumps, value changes, drift correction, and a Kyverno policy —
all driven entirely by `git push`.

**Time:** ~1h live, or self-paced at home.

---

## What you'll build

```
  your GitHub repo                             Minikube cluster
  ┌──────────────────────────┐                ┌─────────────────────────┐
  │ clusters/workshop-cluster │                │ flux-system             │
  │  ├── gitops/flux-system/  │ ◄── pulls ─── │  └─ source + kustomize  │
  │  ├── gitops/fleet-manager │                │     controllers         │
  │  ├── fleet/orchestration  │                │                         │
  │  ├── infra/               │                │ kyverno-operator        │
  │  └── apps/demo-app/       │                │ demo-app (space-app)    │
  └──────────────────────────┘                └─────────────────────────┘
```

Reconciliation chain (top-down, each waits on the previous):

```
fleet-sync
  └── orchestration/
       ├── infra-sync       → HelmRepositories (kyverno, space-app OCI)
       ├── operators-sync   → kyverno base → core (HelmRelease) → overlays (policies)
       └── apps-sync        → demo-app base (ns/configmap/secret) → core (HelmRelease)
```

---

## Prerequisites

Install these once:

| Tool | Install |
|---|---|
| Docker Desktop | https://www.docker.com/products/docker-desktop/ |
| kubectl | `brew install kubectl` / apt / choco |
| Minikube | https://minikube.sigs.k8s.io/docs/start/ |
| Helm | `brew install helm` |
| Flux CLI | https://fluxcd.io/flux/installation/#install-the-flux-cli |

Then:

- In **Docker Desktop → Settings → Resources**, set Memory to **16 GB** and restart Docker.
- You'll need a **GitHub account** and a **Personal Access Token** (classic) with `repo` scope. Keep it handy — you'll export it as `GITHUB_TOKEN`.

Quick sanity check:

```bash
docker version
kubectl version --client
minikube version
helm version
flux --version
```

---

## Part 1 — Start your cluster

```bash
minikube start \
  --profile gitops-workshop \
  --cpus 4 \
  --memory 8192 \
  --disk-size 40g

kubectl get nodes   # should show 1 node Ready
```

Useful profile commands:

```bash
minikube profile list
minikube profile gitops-workshop   # switch active profile
minikube stop                      # later, when you're done
```

---

## Part 2 — Create your GitHub repo

1. On GitHub, create an **empty** repo named `flux-workshop-<your-name>` (e.g. `flux-workshop-stefan`).
2. Do **not** initialize it with a README — Flux will push the first commit.

---

## Part 3 — Bootstrap Flux

Export your credentials and your repo details:

```bash
export GITHUB_TOKEN=<your-personal-access-token>
export GITHUB_USER=<your-github-username>
export CLUSTER_NAME=workshop-cluster
export REPO_NAME=flux-workshop-<your-name>
```

Verify prerequisites, then bootstrap:

```bash
flux check --pre

flux bootstrap github \
  --token-auth \
  --owner="$GITHUB_USER" \
  --repository="$REPO_NAME" \
  --branch=main \
  --path="clusters/$CLUSTER_NAME/gitops" \
  --personal
```

What this does:

- Creates the repo's initial commit with Flux controllers under `clusters/workshop-cluster/gitops/flux-system/`.
- Installs those controllers in the `flux-system` namespace on your cluster.
- Sets Flux to reconcile itself from the repo.

Verify:

```bash
flux get kustomizations
kubectl get pods -n flux-system
```

Then clone the repo locally:

```bash
git clone https://github.com/$GITHUB_USER/$REPO_NAME
cd $REPO_NAME
```

---

## Part 4 — Scaffold the workshop

From the root of your cloned repo, download the `apps/`, `fleet/`, `infra/`, and `gitops/fleet-manager/` folders **into the cluster path**:

```bash
mkdir -p clusters/$CLUSTER_NAME && cd clusters/$CLUSTER_NAME

curl -fL https://github.com/StefanDima14/DevOps-Summit-GitOps-Workshop/archive/refs/heads/main.tar.gz \
  | tar -xz --strip-components=1 \
      DevOps-Summit-GitOps-Workshop-main/apps \
      DevOps-Summit-GitOps-Workshop-main/fleet \
      DevOps-Summit-GitOps-Workshop-main/infra \
      DevOps-Summit-GitOps-Workshop-main/gitops/fleet-manager

cd -   # back to repo root
```

You should now have:

```
clusters/workshop-cluster/
├── gitops/
│   ├── flux-system/      ← from flux bootstrap (don't touch)
│   └── fleet-manager/    ← just downloaded
├── apps/
├── fleet/
└── infra/
```

---

## Part 5 — Wire `fleet-sync` into Flux

Flux's `flux-system` Kustomization only reconciles what its `kustomization.yaml` lists. Add `fleet-sync` as a resource so Flux picks it up.

Move fleet-sync next to the bootstrap files:

```bash
mv clusters/$CLUSTER_NAME/gitops/fleet-manager/fleet-sync.yaml \
   clusters/$CLUSTER_NAME/gitops/flux-system/fleet-sync.yaml
rm -rf clusters/$CLUSTER_NAME/gitops/fleet-manager
```

Edit `clusters/workshop-cluster/gitops/flux-system/kustomization.yaml` and append `fleet-sync.yaml`:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - gotk-components.yaml
  - gotk-sync.yaml
  - fleet-sync.yaml   # ← add this line
```

Commit and push:

```bash
git add clusters
git commit -m "Scaffold workshop apps and wire fleet-sync"
git push
```

---

## Part 6 — Watch it reconcile

Force Flux to pull immediately instead of waiting for the interval:

```bash
flux reconcile source git flux-system
flux reconcile kustomization flux-system --with-source
```

Then watch the chain come up:

```bash
flux get kustomizations -w
```

Expected order (each `Ready=True` before the next starts):

```
flux-system → fleet-sync → infra-sync → operators-sync → kyverno-base
  → kyverno-core → kyverno-overlays → apps-sync → demo-app-base
  → demo-app-core
```

---

## Part 7 — Test the app & Kyverno

### The app

```bash
minikube service frontend -n demo-app --profile gitops-workshop
```

Browser opens on the Space Gallery — you should see the greeting string coming from the ConfigMap.

### Kyverno

```bash
kubectl get all -n kyverno-operator
kubectl get clusterpolicies
```

You should see the `require-app-label` ClusterPolicy (in Audit mode).

---

## Part 8 — GitOps in action

This is the fun part. Everything below is done by **editing a file and pushing to git** — never by `kubectl apply`.

### 8.1 Bump the chart version (v1 → v2 → v3)

Open `clusters/workshop-cluster/apps/demo-app/core/helm-release.yaml` and change:

```yaml
  chart:
    spec:
      chart: space-app
      version: "2.0.0"    # ← was "1.0.0"
```

Commit and push. Within ~1 minute Flux re-runs the Helm upgrade. Refresh the app in your browser — the theme accent changes to gold (v2). Repeat with `"3.0.0"` for the purple "Space Explorer" theme.

Speed it up instead of waiting:

```bash
flux reconcile helmrelease space-app -n demo-app --with-source
```

### 8.2 Change a value (ConfigMap-driven)

In the same file:

```yaml
  values:
    config:
      greeting: "Hello from my GitOps workshop!"
      themeAccent: "#ff66cc"
```

Push. The frontend picks up the new greeting after the next reconcile (the backend pod restarts thanks to the `checksum/config` annotation).

### 8.3 Unlock premium (Secret-driven, on v3)

With `version: "3.0.0"`, set a non-empty token:

```yaml
    secret:
      apiToken: "super-secret-premium-token"
```

Push. The app now shows a "⭐ Premium unlocked" badge and adds premium images + facts.

### 8.4 Drift detection — "Git is the source of truth"

Try to scale the frontend out of band:

```bash
kubectl scale deployment space-app-frontend -n demo-app --replicas=3
kubectl get deploy -n demo-app -w
```

Nothing happens — `HelmRelease` does **not** enforce drift by default. Add drift detection:

```yaml
# clusters/workshop-cluster/apps/demo-app/core/helm-release.yaml
spec:
  interval: 1m
  driftDetection:
    mode: enabled          # values: enabled | warn | disabled
```

Push. Scale again — within ~1 minute it scales back to 1.

Confirm:

```bash
kubectl describe helmrelease space-app -n demo-app | grep -A2 Drift
```

### 8.5 `prune` and `force` on Kustomizations

These two flags control how strictly Flux enforces git on a **Kustomization** (not a HelmRelease):

| Flag | Effect |
|---|---|
| `prune: true` | Remove a file from git → live resource is deleted. |
| `prune: false` | Removing a file leaves the live resource orphaned. |
| `force: true` | Overwrite fields owned by other controllers/users (`kubectl edit`/`kubectl scale`), and recreate resources for immutable-field changes. |
| `force: false` (default) | Normal server-side apply; reports conflict and stops. |

Try it: add a simple `ConfigMap` file under `clusters/workshop-cluster/apps/demo-app/base/`, push, see it appear. Delete it, push, see it disappear (because `demo-app-base` has `prune: true`… or doesn't — read the file and find out).

---

## Part 9 — Multi-cluster mental model

The whole tree lives under `clusters/workshop-cluster/` on purpose. To add a
second cluster you would:

1. Run `flux bootstrap` against that cluster with `--path=./clusters/prod-cluster/gitops`.
2. Copy or adapt `apps/`, `fleet/`, `infra/` under `clusters/prod-cluster/`.

**One repo → many clusters.** Flux reconciles each cluster independently from
the same Git source. You choose what to share and what to diverge simply by
what you put (or symlink, via kustomize bases) in each subtree.

---

## Troubleshooting

**`kustomization path not found: stat /tmp/...: no such file or directory`**
`spec.path` in a Flux Kustomization is **relative to the GitRepository root**,
not to the YAML file's location. If you reorganize folders, every path has to
move with it.

**A change isn't reconciling**
Flux pulls from the git **remote**, not your local copy. Commit + push, then:
```bash
flux reconcile source git flux-system
flux reconcile kustomization <name> --with-source
```

**HelmRelease stuck / failing**
```bash
flux get helmreleases -A
kubectl describe helmrelease space-app -n demo-app
```

**See everything at once**
```bash
flux get all -A
flux events --watch
```

---

## Cleanup

```bash
minikube delete --profile gitops-workshop
```

Your GitHub repo can be deleted from the GitHub UI when you're done.
