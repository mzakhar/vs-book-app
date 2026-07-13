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
3. Update the image digest in `base/deployment.yaml` when you want to deploy a newly published image.

## Important rollout note

- A new app commit does not automatically produce a new rollout on the cluster if `k8s/base/deployment.yaml` still points at the same image digest.
- The current manifest pins `ghcr.io/mzakhar/vs-book-app` by digest for deterministic rollouts.
- Flux reconciles Git state, not GHCR tag contents, so a fresh `:main` image alone is not a deployment event.
- After a PR merges and the container publish workflow completes, run this from the repo root to pin and push the latest `:main` digest:

  ```powershell
  npm run deploy:pin-image -- -Commit -Push
  ```

## Flux bootstrap

If Flux is not already installed on the cluster, bootstrap it against this repository and the path that contains the Flux objects:

```sh
flux bootstrap github \
  --owner=mzakhar \
  --repository=vs-book-app \
  --branch=main \
  --path=k8s/flux \
  --private
```

After bootstrap, confirm:

- `flux get kustomizations -A`
- `flux get sources git -A`
- `kubectl get pods -n vs-book-app`

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

## Cutover

1. Keep the existing nginx/systemd deployment live while the cluster version comes up.
2. Wait for the `vs-book-app` deployment to become ready.
3. Verify `http://<server-ip>/books/` loads through Traefik.
4. Verify book CRUD, note CRUD, and data persistence after a pod restart.
5. Only then disable or bypass the legacy deployment path.

## Rollback

1. Restore traffic to the legacy deployment if the cluster version is unhealthy.
2. Revert the manifest or image reference in Git.
3. Let Flux reconcile back to the last known good state.
4. Do not delete the PVC during rollback unless data loss is intentional.
