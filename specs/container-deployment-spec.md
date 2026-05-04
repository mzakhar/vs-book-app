# Container Deployment Spec

## Goal
Make `Vs-book-app` deployable as a containerized workload on a home Ubuntu server running k3s, with persistent SQLite storage, repeatable builds, private image publishing to GHCR, and a GitOps-friendly deployment path.

## Current State
- App is split into `frontend/` and `backend/`.
- Production today is non-containerized: build locally, copy artifacts to a server, run Node via `systemd`, and proxy `/books/` through nginx.
- Frontend is already built for a `/books/` base path.
- Backend serves the frontend build in production.
- SQLite database is a single file at repo root: `books.db`, with WAL enabled.

## Target Outcome
- A production container image can run the full app.
- SQLite data persists outside the container lifecycle.
- Deployment targets k3s first, without a separate Docker Compose phase unless later requested.
- CI builds and publishes private images to GHCR.
- Deployment manifests and runtime configuration live in Git.
- Traffic stays LAN-only behind k3s Traefik.
- The external app path remains `/books/`, and this phase does not require custom LAN DNS.

## Constraints
- SQLite means the app must run as a single writer instance.
- The database volume must be mounted at a stable path and owned by the runtime user.
- WAL creates sidecar files (`.db-wal`, `.db-shm`), so persistence must cover the whole database directory, not only `books.db`.
- k3s storage choice matters. With `local-path`, the workload is effectively node-pinned and uses `ReadWriteOnce` storage.
- Images remain private, so k3s must authenticate to GHCR with an `imagePullSecret`.
- This phase includes persistence only, not backup/restore automation.
- Clients should be able to access the app by IP or existing LAN hostname, for example `http://192.168.1.3/books/`, without introducing Pi-hole or router DNS work.

## Recommended Direction
1. Package the app as one container image containing the built frontend and compiled backend.
2. Move runtime database storage to a dedicated directory such as `/data`, not the image filesystem.
3. Make the DB path configurable with an environment variable, with `/data/books.db` as the production default.
4. Deploy one replica only.
5. Publish private images with GitHub Actions to GHCR.
6. Use Flux for GitOps so k3s pulls deployment state from Git without inbound exposure from GitHub.
7. Route the app through Traefik at `/books/`.
8. Avoid introducing custom LAN DNS as part of this phase.

## Challenge to the Proposed Architecture
The GHCR + GitHub Actions + Flux direction is sound. The main thing to be explicit about is that `local-path` plus SQLite is not portable or highly available. It is acceptable here only because you have already constrained the app to single-user and single-replica.

For this app, Kubernetes is acceptable only if we are disciplined:
- one replica
- one PVC
- no shared multi-writer storage assumption
- no autoscaling story
- willingness to pin or re-pin the workload to the node holding the volume

The part I would normally question is the commitment to `/books/`, because subpath hosting adds avoidable complexity across Vite base config, Traefik routing, and ingress rewrites. In this case I recommend keeping `/books/` anyway, because avoiding custom LAN DNS in this phase is the more important simplification for your environment.

If you later expect high availability, multi-node failover, or concurrent writers, SQLite becomes the constraint and Postgres should replace it before further platform work.

## Deliverables
- Containerization spec and rollout plan
- Runtime configuration contract
- Persistent storage plan for SQLite
- CI image build/publish plan for private GHCR images
- k3s deployment plan with Traefik ingress and a PVC
- Flux bootstrap and repo-layout plan
- Cutover and rollback notes

## Decided Assumptions
1. First production target is k3s, not a standalone Docker host.
2. The app is single-user and intentionally single-replica.
3. Flux is the preferred GitOps choice unless a blocker appears.
4. The cluster storage backend is assumed to be `local-path`.
5. Images will remain private in GHCR.
6. The app should remain LAN-only behind Traefik.
7. `/books/` is the working deployment path for this phase.
8. This phase covers persistence, not backup/restore.
9. No custom LAN DNS dependency should be introduced in this phase.

## Proposed Phase Breakdown
1. Runtime hardening
   - Make filesystem expectations explicit.
   - Externalize the database path and any runtime config.
2. Image packaging
   - Build one production image with minimal runtime contents.
3. CI publishing
   - Build, validate, and push immutable images to GHCR.
4. Cluster deployment
   - Add Kubernetes manifests or a Helm chart with one replica, one PVC, and Traefik ingress.
5. GitOps integration
   - Bootstrap Flux and let the cluster pull desired state from Git.

## Approval Boundary
No code changes should start until this spec is revised against your answers and explicitly approved.

## Implementation Progress
- [x] Verified current code matches the approved deployment assumptions for `/books/`, production static serving, and root-level SQLite with WAL.
- [x] Runtime hardening: database path is now configurable with `DB_PATH`, and the app creates the parent directory before opening SQLite.
- [x] Runtime hardening: added `/api/health` for container and Kubernetes probes.
- [x] Image packaging: added a multi-stage `Dockerfile` and `.dockerignore` for a single production image.
- [x] CI publishing: added a GitHub Actions workflow to build and publish private images to GHCR.
- [x] Cluster deployment: added k3s manifests for a namespace, single-replica deployment, PVC, service, Traefik middleware, and ingress at `/books/`.
- [x] GitOps integration: added a Flux `Kustomization` manifest and a repo-local `k8s/` layout for Git-managed deployment state.
- [x] Added cluster setup notes covering the GHCR pull secret, image path replacement, and the `/books/` routing model.
- [x] Added Flux bootstrap, cutover, rollback, and deployment update runbooks.

## Runtime Configuration Contract
- `NODE_ENV=production`
- `PORT=3000`
- `DB_PATH=/data/books.db`
- The app must have write access to the parent directory of `DB_PATH`.
- Persistence must cover the entire database directory so SQLite WAL sidecar files survive restarts.

## Flux Bootstrap Plan
1. Install Flux on the k3s cluster if it is not already present.
2. Bootstrap Flux against this repository and branch.
3. Point Flux at the repo path containing the deployment manifests.
4. Create the `ghcr-creds` pull secret in the `vs-book-app` namespace before the first reconcile.
5. Confirm the `vs-book-app` `Kustomization` becomes ready before cutover.

### Example Bootstrap Command
```sh
flux bootstrap github \
  --owner=mzakhar \
  --repository=vs-book-app \
  --branch=main \
  --path=k8s/flux \
  --private
```

## Deployment Update Flow
1. Merge or push deployment changes to the branch Flux watches.
2. Let GitHub Actions publish a new immutable GHCR image.
3. Update `k8s/base/deployment.yaml` to the desired tag or digest instead of relying on `:main` for long-term operations.
4. Commit that manifest change.
5. Wait for Flux to reconcile, then confirm the deployment is ready and the app is reachable at `/books/`.

## Cutover Runbook
1. Ensure the current non-containerized deployment remains available during cluster bring-up.
2. Bootstrap Flux and confirm `flux-system` is healthy.
3. Create the `vs-book-app` namespace and `ghcr-creds` secret if Flux is not creating the namespace first.
4. Apply or reconcile the `k8s/base` manifests.
5. Confirm the PVC binds successfully and the pod reaches ready state.
6. Browse to `http://<server-ip>/books/` and verify the UI loads.
7. Exercise the critical flows:
   - list books
   - create or edit a book
   - create or edit a note
   - verify data persists after a pod restart
8. Switch LAN traffic from the legacy nginx/systemd deployment to Traefik only after the Kubernetes deployment is verified.
9. Keep the old deployment intact until persistence and routing are both confirmed.

## Rollback Runbook
1. If the new deployment fails before cutover, keep serving traffic from the legacy systemd/nginx deployment and fix the cluster manifests separately.
2. If the new deployment fails after cutover, restore LAN traffic to the legacy deployment immediately.
3. Revert the manifest or image tag change in Git so Flux reconciles back to the last known good state.
4. If the failure is image-specific, pin the deployment to the last known good digest.
5. Do not delete the PVC during rollback unless you intentionally want to discard SQLite data.
6. After rollback, inspect pod logs, Flux events, and PVC mount behavior before attempting another cutover.

## Residual Risks
- `local-path` storage keeps the workload effectively tied to one node.
- SQLite remains a single-writer design and is not suitable for horizontal scaling.
- The current manifests assume Traefik CRDs and the default k3s ingress class are present.
- Private GHCR access depends on a valid pull secret lifecycle outside this repo.
