# ShopNova — Full-stack E-commerce (DevOps-ready)

A separate starter project designed to sit alongside, not replace, your existing `k3s-flask-project`.

## Stack
- Frontend: React + Vite + Tailwind CSS
- Backend: Python + Flask REST API + SQLAlchemy + JWT
- Database: PostgreSQL
- Local development: Docker Compose
- Kubernetes: separate frontend, API and PostgreSQL manifests
- CI examples: Jenkins pipeline and Trivy image scan

## Features in this starter
- Premium responsive storefront, category filters, search, product cards
- Register / login with JWT
- Persistent cart API
- Create orders from cart and view order history
- PostgreSQL-backed products, users, carts and orders
- Health endpoint for Kubernetes probes

> This is a development/starter application, not a production-certified commerce platform. Before public production use, add HTTPS, managed secrets, rate limiting, email verification/password reset, audit logging, robust migrations, backups, payment-provider integration, and security review. Checkout creates an order only; it does not charge a payment method.

## 1. Keep existing project safe
On your server, do not copy this over `/root/rohit/k3s-flask-project`. Extract into a new directory, for example:
```bash
mkdir -p /root/rohit/shopnova-ecommerce
# upload and extract the ZIP into that directory
```
Keep the existing Git repository, Jenkins credentials, Kubernetes secrets, and manifests unchanged until the new project is tested.

## 2. Run locally with Docker Compose
Requirements: Docker Engine and Docker Compose plugin.
```bash
cp .env.example .env
# Change SECRET_KEY and JWT_SECRET_KEY before use beyond local testing.
docker compose up --build
```
Open:
- Storefront: http://localhost:8080
- API health: http://localhost:5000/api/health

Demo products are seeded automatically. Register an account in the UI to use cart and checkout.

## 3. Run without Docker
Backend:
```bash
cd backend
python -m venv .venv
# Linux/macOS:
source .venv/bin/activate
# Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
export DATABASE_URL=sqlite:///shopnova.db
export SECRET_KEY=replace-me
export JWT_SECRET_KEY=replace-me-too
flask --app app run --debug
```
Frontend in another terminal:
```bash
cd frontend
npm install
npm run dev
```
For local Vite development, set `VITE_API_BASE_URL=http://localhost:5000/api` in `frontend/.env.local`.

## 4. API overview
- `GET /api/health`
- `GET /api/products`
- `GET /api/products/<id>`
- `POST /api/auth/register` `{ "name": "...", "email": "...", "password": "..." }`
- `POST /api/auth/login` `{ "email": "...", "password": "..." }`
- `GET /api/cart` (Bearer token)
- `POST /api/cart` `{ "product_id": 1, "quantity": 1 }` (Bearer token)
- `PATCH /api/cart/<item_id>` `{ "quantity": 2 }` (Bearer token)
- `DELETE /api/cart/<item_id>` (Bearer token)
- `POST /api/orders` (Bearer token)
- `GET /api/orders` (Bearer token)

## 5. Build images
Build from repository root:
```bash
docker build -t shopnova-api:dev ./backend
docker build -t shopnova-web:dev ./frontend
```
Push to your own registry after replacing the example image names in Kubernetes manifests.

## 6. Kubernetes / K3s
The `k8s/` directory is a starter baseline. Review it before applying:
- `namespace.yaml`
- `postgres.yaml` uses a PVC and a Secret placeholder
- `api.yaml`
- `web.yaml`
- `ingress.yaml` (example host `shopnova.example.com`)

Update image names to your registry and configure secrets using your cluster's approved secret-management approach. Do not commit real passwords or signing keys. Confirm your existing Traefik/IngressClass, StorageClass, DNS, TLS and resource policies before applying.

Apply only after editing:
```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/api.yaml
kubectl apply -f k8s/web.yaml
# edit host/TLS first, then:
kubectl apply -f k8s/ingress.yaml
```
Verify:
```bash
kubectl get all -n shopnova
kubectl logs deploy/shopnova-api -n shopnova
kubectl rollout status deploy/shopnova-api -n shopnova
```

## 7. Jenkins / Trivy
`Jenkinsfile` is a template, not a drop-in replacement for your current working pipeline. Set Jenkins credentials `registry-username` and `registry-password` and replace `YOUR_DOCKERHUB_USER`. Validate the pipeline in a separate job/branch before connecting it to Argo CD. It builds and scans images, then pushes only if the Trivy scan passes its configured severity gate.
For a real GitOps flow, a separate pipeline stage/repository should update the image tag in the GitOps repo, and Argo CD should sync that repository. This template intentionally does not modify any GitOps repository.

## Suggested next steps
1. Run locally and verify register/login/cart/order.
2. Add tests and run `pytest`.
3. Build and scan both images.
4. Push to a new repository and configure a separate Jenkins job.
5. Add manifests to a separate GitOps repo/path and connect Argo CD only after reviewing cluster conventions.
