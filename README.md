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
  ┌──────────────────────────┐               ┌─────────────────────────┐
  │ clusters/workshop-cluster│               │ flux-system             │
  │  ├── gitops/flux-system/ │ ◄── pulls ─── │  └─ source + kustomize  │
  │  ├── gitops/fleet-manager│               │     controllers         │
  │  ├── fleet/orchestration │               │                         │
  │  ├── infra/              │               │ kyverno-operator        │
  │  └── apps/demo-app/      │               │ demo-app (space-app)    │
  └──────────────────────────┘               └─────────────────────────┘
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
| Flux CLI | https://fluxcd.io/flux/installation/#install-the-flux-cli |

You'll also need a **GitHub account** and a **Personal Access Token (classic)**. Create one like this:

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)**
   (direct link: https://github.com/settings/tokens).
2. Click **Generate new token → Generate new token (classic)**.
3. **Note:** `flux-workshop` (or anything recognizable).
4. **Expiration:** 7 days is plenty for this workshop.
5. **Scopes:** tick **`repo`** (the whole block — gives Flux read/write access to your repo).
6. Click **Generate token** and **copy the value immediately** — GitHub won't show it again. You'll export it as `GITHUB_TOKEN` in Part 3.

Quick sanity check:

```bash
docker version
kubectl version --client
minikube version
flux --version
```

---

## Part 1 — Start your cluster

```bash
minikube start \
  --profile gitops-workshop \
  --cpus 4 \
  --memory 4096 \
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

Verify the bootstrap:

```bash
flux check                                 # all controllers healthy?
flux get sources git -A                    # GitRepository "flux-system" Ready?
flux get kustomizations -A                 # flux-system Kustomization Ready?
kubectl get pods -n flux-system            # 4 controllers running
```

Then clone the repo locally:

```bash
git clone https://github.com/$GITHUB_USER/$REPO_NAME
cd $REPO_NAME
```

---

## Part 4 — Load the workshop files

From the root of your cloned repo, download `apps/`, `fleet/`, `infra/`, and `gitops/fleet-manager/` **into the cluster path**:

```bash
cd clusters/$CLUSTER_NAME

curl -fL https://github.com/StefanDima14/DevOps-Summit-GitOps-Workshop/archive/refs/heads/main.tar.gz \
  | tar -xz --strip-components=1 \
      DevOps-Summit-GitOps-Workshop-main/apps \
      DevOps-Summit-GitOps-Workshop-main/fleet \
      DevOps-Summit-GitOps-Workshop-main/infra \
      DevOps-Summit-GitOps-Workshop-main/gitops/fleet-manager

cd -   # back to repo root
```

Commit and push:

```bash
git add clusters
git commit -m "Load workshop apps, infra, and fleet manifests"
git push
```

Watch the chain come up:

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

## What you just downloaded

```
clusters/workshop-cluster/
├── gitops/
│   ├── flux-system/                         ← from flux bootstrap (don't touch)
│   │   ├── gotk-components.yaml             # Flux controllers (source, kustomize, helm, notification)
│   │   ├── gotk-sync.yaml                   # GitRepository + root Kustomization pointing at this folder
│   │   └── kustomization.yaml               # lists the two files above
│   └── fleet-manager/
│       ├── kustomization.yaml               # lists fleet-sync.yaml
│       └── fleet-sync.yaml                  # entry point: starts the fleet chain
│
├── fleet/                                   ← orchestration layer — "what reconciles what"
│   ├── kustomization.yaml                   # points to orchestration/
│   ├── orchestration/
│   │   ├── kustomization.yaml               # lists the three *-sync files below
│   │   ├── infra-sync.yaml                  # Kustomization → infra/resources (HelmRepos)
│   │   ├── operators-sync.yaml              # Kustomization → fleet/operators-manifests
│   │   └── apps-sync.yaml                   # Kustomization → fleet/apps-manifests
│   ├── operators-manifests/
│   │   └── kyverno/
│   │       ├── base/kyverno-base.yaml       # Kustomization → infra/operators/kyverno/base (namespace)
│   │       ├── core/kyverno-core.yaml       # Kustomization → infra/operators/kyverno/core (HelmRelease)
│   │       └── overlays/kyverno-overlays.yaml # Kustomization → .../overlays (ClusterPolicy)
│   └── apps-manifests/
│       └── demo-app/
│           ├── base/demo-app-base.yaml      # Kustomization → apps/demo-app/base (namespace)
│           └── core/demo-app-core.yaml      # Kustomization → apps/demo-app/core (HelmRelease)
│
├── infra/                                   ← actual infra K8s resources
│   ├── resources/helm-repositories/
│   │   ├── kyverno-helm-repo.yaml           # HelmRepository (kyverno chart source)
│   │   └── space-app-helm-repo.yaml         # HelmRepository (OCI, your space-app charts)
│   └── operators/kyverno/
│       ├── base/namespace.yaml              # kyverno-operator namespace
│       ├── core/helmrelease-kyverno.yaml    # HelmRelease installing Kyverno
│       └── overlays/policies.yaml           # require-app-label ClusterPolicy (Audit mode)
│
└── apps/                                    ← actual app K8s resources
    └── demo-app/
        ├── base/namespace.yaml              # demo-app namespace
        └── core/helm-release.yaml           # HelmRelease installing space-app
```

**Rule of thumb:** `fleet/` holds Flux **Kustomizations** (how/when to reconcile). `infra/` and `apps/` hold the **real resources** those Kustomizations deploy. Splitting them lets the orchestration graph (`dependsOn`, `wait`, `interval`) live separately from the manifests it drives.

---

## How Flux discovers and applies everything

Flux never scans the whole repo — it follows a chain. When something breaks,
walk this chain from the top until you find the first link that isn't `Ready`.

1. **Flux controllers poll the GitRepository** `flux-system`
   (URL = your repo, branch = `main`). Set by `flux bootstrap`.

2. **Root Kustomization `flux-system`** (from `gotk-sync.yaml`) reconciles
   `./clusters/workshop-cluster/gitops/`. It walks that folder and picks up
   everything listed in each `kustomization.yaml` — the bootstrap files in
   `flux-system/` and your `fleet-sync.yaml` under `fleet-manager/`.

3. **`fleet-sync`** reconciles `./clusters/workshop-cluster/fleet/`. That
   folder's `kustomization.yaml` points at `orchestration/`, which registers
   three child Kustomizations:

   - `infra-sync` — reconciles `infra/resources/` → creates the HelmRepositories.
   - `operators-sync` (waits on `infra-sync`) — reconciles `fleet/operators-manifests/`, which registers `kyverno-base` → `kyverno-core` → `kyverno-overlays`.
   - `apps-sync` (waits on `operators-sync`) — reconciles `fleet/apps-manifests/`, which registers `demo-app-base` → `demo-app-core`.

4. **Leaf Kustomizations** (`kyverno-*`, `demo-app-*`) point at the real
   manifests under `infra/` and `apps/` and apply them. `demo-app-core`
   applies a **HelmRelease**, which the helm-controller turns into an actual
   chart install.

Every `path:` in a Flux Kustomization is **relative to the GitRepository root**
(not to the YAML file's own folder). If you move files around, paths have to
follow.

### Verifying each layer

```bash
# 1. Source: is Flux able to pull from GitHub?
flux get sources git -A

# 2. HelmRepositories: are chart sources reachable?
flux get sources helm -A

# 3. All Kustomizations — which ones are Ready?
flux get kustomizations -A

# 4. HelmReleases — which charts are installed?
flux get helmreleases -A

# 5. Everything at once
flux get all -A

# 6. Live event stream (great during the workshop)
flux events --watch

# 7. Drill into a specific failing resource
flux get kustomizations -A | grep -v True          # find the unhappy one
kubectl describe kustomization <name> -n flux-system
kubectl describe helmrelease space-app -n demo-app
```

Force a reconcile when you don't want to wait for the next interval:

```bash
flux reconcile source git flux-system              # re-pull the repo
flux reconcile kustomization fleet-sync            # re-apply a Kustomization
flux reconcile helmrelease space-app -n demo-app --with-source
```

---

## Part 5 — Live troubleshooting: the chain is stuck

When you ran `flux get kustomizations -w` at the end of Part 4, the last two rows
probably never went green:

```
demo-app-base    False    kustomization path not found: stat /tmp/.../apps/demo-app/base: no such file or directory
demo-app-core    False    dependency 'demo-app-base' is not ready
```

That's on purpose. The files you just loaded contain **one real-world bug** —
find it and fix it **from git** (no `kubectl apply`).

### Hints

1. `apps-sync` itself is Ready — so its *parent* chain (fleet-sync → apps-sync)
   is fine. The break is on the two **children** it registered.
2. Read the error carefully: `stat .../apps/demo-app/base: no such file or directory`.
   Flux is looking at the *repo root*, not under `clusters/workshop-cluster/`.
3. Confirm the files really exist:
   ```bash
   ls clusters/workshop-cluster/apps/demo-app/base
   ls clusters/workshop-cluster/apps/demo-app/core
   ```
   They do. So the files are there, but Flux is looking in the wrong place.
4. Open the two leaf Kustomizations:
   ```
   clusters/workshop-cluster/fleet/apps-manifests/demo-app/base/demo-app-base.yaml
   clusters/workshop-cluster/fleet/apps-manifests/demo-app/core/demo-app-core.yaml
   ```
   Compare their `spec.path` to the `spec.path` in `infra-sync.yaml`,
   `operators-sync.yaml`, and `apps-sync.yaml` under `fleet/orchestration/`.
   Spot the inconsistency.
5. Remember the rule: **`spec.path` is relative to the GitRepository root**,
   not to the YAML file's own folder.

### Solution

The two leaf Kustomizations are missing the `./clusters/workshop-cluster/`
prefix. Edit both files:

```yaml
# clusters/workshop-cluster/fleet/apps-manifests/demo-app/base/demo-app-base.yaml
spec:
  path: ./clusters/workshop-cluster/apps/demo-app/base   # was: ./apps/demo-app/base
```

```yaml
# clusters/workshop-cluster/fleet/apps-manifests/demo-app/core/demo-app-core.yaml
spec:
  path: ./clusters/workshop-cluster/apps/demo-app/core   # was: ./apps/demo-app/core
```

Commit and push:

```bash
git add clusters/workshop-cluster/fleet/apps-manifests/demo-app
git commit -m "Fix demo-app Kustomization paths"
git push
```

Don't wait — force a reconcile:

```bash
flux reconcile source git flux-system
flux reconcile kustomization demo-app-base
```

Within ~30 seconds both demo-app Kustomizations go Ready, the HelmRelease
installs, and the app comes up.

### Why this is a classic footgun

Every Flux Kustomization `spec.path` is resolved against the **GitRepository
root**, never the file's own directory. Writers forget this all the time when
they nest manifests into folders for readability. Whenever you see
`kustomization path not found`, check the path prefix first.

---

## Part 6 — Test the app & Kyverno

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

## Part 7 — GitOps in action

This is the fun part. Everything below is done by **editing a file and pushing to git** — never by `kubectl apply`.

### 7.1 Bump the chart version (v1 → v2 → v3)

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

### 7.2 Change a value (ConfigMap-driven)

In the same file:

```yaml
  values:
    config:
      greeting: "Hello from my GitOps workshop!"
      themeAccent: "#ff66cc"
```

Push. The frontend picks up the new greeting after the next reconcile (the backend pod restarts thanks to the `checksum/config` annotation).

### 7.3 Unlock premium (Secret-driven, on v3)

With `version: "3.0.0"`, set a non-empty token:

```yaml
    secret:
      apiToken: "super-secret-premium-token"
```

Push. The app now shows a "⭐ Premium unlocked" badge and adds premium images + facts.

### 7.4 Drift detection on a HelmRelease

Scale the frontend out of band:

```bash
kubectl scale deployment space-app-frontend -n demo-app --replicas=3
kubectl get deploy -n demo-app -w
```

The Deployment **does** scale to 3 — and it stays there. A `HelmRelease` doesn't
watch the cluster between upgrades; it only acts when the **chart or values
change**, so Flux won't revert the manual edit on its own. To make it snap the
replicas back, turn on drift detection:

```yaml
# clusters/workshop-cluster/apps/demo-app/core/helm-release.yaml
spec:
  interval: 1m
  driftDetection:
    mode: enabled    # enabled | warn | disabled
```

With `mode: enabled`, every `interval` Flux diffs what's live against what
the chart would render. If anything drifted (scaled replicas, edited env var,
deleted resource), Flux puts it back — no chart change required. `warn` only
logs the drift; `disabled` is the default.

Push the change, wait for Flux to reconcile the HelmRelease, then scale to 3
again — within ~1 minute it snaps back to 1.

```bash
kubectl describe helmrelease space-app -n demo-app | grep -A2 Drift
```

#### How this differs from `force` on a Kustomization

Both can "undo" someone's `kubectl edit`, but they live on different objects
and solve slightly different problems:

| | `driftDetection` (HelmRelease) | `force` (Kustomization) |
|---|---|---|
| What it manages | Resources rendered by a **Helm chart** | Plain YAML files tracked by a **Kustomization** |
| When it runs | Every `interval`, continuously | Every `interval`, continuously |
| What triggers a fix | Any diff vs. the chart output | Any server-side apply conflict |
| Typical use | Revert manual changes to chart-managed deployments | Overwrite fields owned by other controllers, recreate immutable fields |

Short version: use `driftDetection` when the resource is deployed by a
HelmRelease, use `force` when it's deployed by a Kustomization.

### 7.5 `prune` and `force` on Kustomizations

These two flags live on **Kustomizations** (not HelmReleases) and control how strictly Flux enforces git:

| Flag | Effect |
|---|---|
| `prune: true` | Remove a file from git → live resource is deleted. |
| `prune: false` (default) | Removing a file leaves the live resource orphaned. |
| `force: true` | Overwrite fields owned by other controllers/users (`kubectl edit`/`kubectl scale`), and recreate resources for immutable-field changes. |
| `force: false` (default) | Normal server-side apply; reports conflict and stops. |

#### Walkthrough: prove what `prune` does

Before starting, peek at the current setting — open
`clusters/workshop-cluster/fleet/apps-manifests/demo-app/base/demo-app-base.yaml`:

```yaml
spec:
  prune: false   # we'll flip this in step 3
```

**Step 1 — add a ConfigMap and see it appear**

Create `clusters/workshop-cluster/apps/demo-app/base/workshop-config.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: workshop-config
  namespace: demo-app
data:
  owner: "your-name"
  note: "added during the workshop"
```

Register it with kustomize — edit
`clusters/workshop-cluster/apps/demo-app/base/kustomization.yaml`:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - namespace.yaml
  - workshop-config.yaml   # add this line
```

Commit, push, reconcile, verify:

```bash
git add clusters/workshop-cluster/apps/demo-app/base
git commit -m "Add workshop-config ConfigMap"
git push
flux reconcile kustomization demo-app-base
kubectl get configmap workshop-config -n demo-app
```

You should see the ConfigMap.

**Step 2 — delete it from git, watch it orphan**

Remove the file and its reference:

```bash
rm clusters/workshop-cluster/apps/demo-app/base/workshop-config.yaml
```

Edit `kustomization.yaml` back to the original (drop the `workshop-config.yaml`
line). Then:

```bash
git add clusters/workshop-cluster/apps/demo-app/base
git commit -m "Remove workshop-config from git"
git push
flux reconcile kustomization demo-app-base
kubectl get configmap workshop-config -n demo-app
```

The ConfigMap **is still there** even though git no longer knows about it —
that's `prune: false`. In real life, this is how stale `ConfigMap`s and
`Secret`s pile up on long-lived clusters.

**Step 3 — flip `prune: true` and watch it get cleaned up**

Edit
`clusters/workshop-cluster/fleet/apps-manifests/demo-app/base/demo-app-base.yaml`:

```yaml
spec:
  prune: true   # was: false
```

Commit, push, reconcile:

```bash
git add clusters/workshop-cluster/fleet/apps-manifests/demo-app/base/demo-app-base.yaml
git commit -m "Enable prune on demo-app-base"
git push
flux reconcile kustomization demo-app-base
kubectl get configmap workshop-config -n demo-app
```

This time the ConfigMap is **gone** — with `prune: true`, the Kustomization is
now the source of truth for what exists under it, and the orphan gets deleted.

**Why teams don't default to `prune: true`**: production namespaces often hold
resources created outside GitOps (other teams, legacy, one-off debugging). A
careless `prune: true` on a shared Kustomization can wipe other people's work.
Turn it on only when the Kustomization fully owns its scope.

---

## Part 8 — Multi-cluster mental model

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
