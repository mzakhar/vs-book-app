# k3s Deployment Notes

This directory contains the Git-managed deployment state for `Vs-book-app`.

## Runtime contract

- The container runs the compiled backend and serves the built frontend.
- The app expects a writable database directory and uses `DB_PATH=/data/books.db` in production.
- SQLite persistence must include the full `/data` directory so WAL sidecar files remain on the volume.
- The deployment is intentionally pinned to one replica.

## First-time cluster setup

1. Create the GHCR pull secret in the `vs-book-app` namespace.
2. Apply `k8s/base` directly, or let Flux reconcile `k8s/flux/vs-book-app-kustomization.yaml`.
3. Update the image tag in `base/deployment.yaml` when you want to deploy a tag or commit-specific image instead of `:main`.

## Required secret

Create the image pull secret with a GitHub username and a token that can read private GHCR packages:

```sh
kubectl create namespace vs-book-app
kubectl create secret docker-registry ghcr-creds \
  --namespace vs-book-app \
  --docker-server=ghcr.io \
  --docker-username=YOUR_GITHUB_USERNAME \
  --docker-password=YOUR_GITHUB_TOKEN
```

## Traffic model

- Traefik handles the public LAN path at `/books`.
- The middleware strips the `/books` prefix before requests hit the Node app.
- The backend continues serving routes at `/api/*`, while the frontend asset URLs stay rooted at `/books/`.
