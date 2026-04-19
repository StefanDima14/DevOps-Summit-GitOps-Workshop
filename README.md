# Space Gallery — Minikube / FluxCD Workshop

A tiny 2-tier app (frontend + backend) shipped in 3 versions so you can
demonstrate GitOps / FluxCD by changing image tags and watching the cluster
reconcile.

## Layout

```
backend/{v1,v2,v3}   Node.js + Express API that returns a random space image
frontend/{v1,v2,v3}  Nginx serving static HTML, proxies /api/ to backend
k8s/                 Deployment + Service manifests
build.sh             Builds all images into minikube's docker daemon
```

## Run

```bash
minikube start
./build.sh                       # builds v1/v2/v3 of both images
kubectl apply -f k8s/
minikube service frontend        # opens the app in your browser
```

To switch versions (the workshop move):

```bash
kubectl set image deployment/backend  backend=ghcr.io/stefandima14/space-backend:v2
kubectl set image deployment/frontend frontend=ghcr.io/stefandima14/space-frontend:v2
```

…or with FluxCD, just edit the image tag in `k8s/backend.yaml` /
`k8s/frontend.yaml`, commit, push, and let Flux reconcile.

## What changed between versions

### v1 — baseline
- Backend returns `{ url }` only.
- Frontend: dark grey background, plain "Space Gallery" title, simple button.

### v2 — image titles + "space" theme
- **Backend**: each image now has a `title` field; added 2 more images (7 total). Health endpoint reports `v2`.
- **Frontend**: deep-blue background (`#0b1a3a`), gold accent color (`#ffd166`), rocket emoji in header, image title shown under the picture, styled button.

### v3 — fun facts + purple/cosmic theme
- **Backend**: response now also includes a random `fact` string from a curated list. Health endpoint reports `v3`.
- **Frontend**: purple gradient background, glowing title ("🌌 Space Explorer"), "✨ Discover" button, Georgia serif font, rounded image with glow shadow, and a quoted fact card below the image.

Each change is intentionally visible in the browser so workshop attendees can
*see* the rollout happen when Flux reconciles a new tag.

## Suggested workshop flow

1. Deploy v1 — show the running app.
2. Edit `k8s/backend.yaml` + `k8s/frontend.yaml` to `:v2`, commit, push.
3. Watch Flux pick up the change (`flux get kustomizations -w`) and the pods roll.
4. Repeat for `:v3`.
5. Optionally roll *back* to `:v1` by reverting the commit — GitOps FTW.
