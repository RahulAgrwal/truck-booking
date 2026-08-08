# GCP one-time setup

Run this once per project, before the first `gcloud builds submit`. Afterwards, deploys are just:

```bash
gcloud builds submit --config cloudbuild.yaml .
```

Set your shell up first:

```bash
export PROJECT_ID="your-project-id"
export REGION="asia-south1"
gcloud config set project "$PROJECT_ID"
```

## 1. Enable APIs

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudscheduler.googleapis.com \
  places-backend.googleapis.com \
  distance-matrix-backend.googleapis.com
```

> Maps APIs need **billing enabled** on the project. Without it, Places returns
> `REQUEST_DENIED` and the autocomplete silently falls back to a plain text input.

## 2. Artifact Registry

The repo name must match `_REPO` in `cloudbuild.yaml` (default `truckinggo`).

```bash
gcloud artifacts repositories create truckinggo \
  --repository-format=docker \
  --location="$REGION" \
  --description="TruckingGO container images"
```

## 3. Secrets

Twelve secrets, all read from Secret Manager — nothing sensitive is ever committed or passed as a build
substitution. See TechnicalDocument.md §9.3 for what each one feeds.

```bash
create_secret () {  # create_secret NAME VALUE
  printf '%s' "$2" | gcloud secrets create "$1" --data-file=- --replication-policy=automatic
}

# --- Database (Neon, database trucking_go) ---
create_secret DATABASE_URL "postgresql://USER:PASSWORD@ep-xxx-pooler.REGION.aws.neon.tech/trucking_go?sslmode=require"
create_secret DIRECT_URL   "postgresql://USER:PASSWORD@ep-xxx.REGION.aws.neon.tech/trucking_go?sslmode=require"

# --- Firebase client keys (public — they ship in the browser bundle) ---
create_secret FIREBASE_API_KEY     "AIza..."
create_secret FIREBASE_AUTH_DOMAIN "your-app.firebaseapp.com"
create_secret FIREBASE_PROJECT_ID  "your-firebase-project"
create_secret FIREBASE_APP_ID      "1:1234567890:web:abcdef"

# --- Firebase Admin (server only) ---
create_secret FIREBASE_ADMIN_PROJECT_ID  "your-firebase-project"
create_secret FIREBASE_ADMIN_CLIENT_EMAIL "firebase-adminsdk-xxxx@your-project.iam.gserviceaccount.com"

# --- Google Maps ---
# Client key: restrict by HTTP referrer + Places API only. Ships in the browser bundle.
create_secret GOOGLE_MAPS_API_KEY        "AIza..."
# Server key: restrict to the Distance Matrix API (and by IP if you can). NEVER public.
create_secret GOOGLE_MAPS_SERVER_API_KEY "AIza..."

# --- Cron bearer token ---
create_secret CRON_SECRET "$(openssl rand -hex 32)"
```

**The private key needs a file, not a shell string** — a PEM contains real newlines that `printf` would
mangle:

```bash
# Download the service-account JSON from Firebase Console → Project Settings →
# Service accounts → Generate new private key, then extract the PEM:
jq -r '.private_key' service-account.json > /tmp/fb-key.pem
gcloud secrets create FIREBASE_ADMIN_PRIVATE_KEY --data-file=/tmp/fb-key.pem --replication-policy=automatic
rm /tmp/fb-key.pem service-account.json
```

`adminApp.ts` accepts both real newlines (Secret Manager) and `\n` escapes (a `.env.local`), so the same
code works in both places.

To rotate any secret later, add a version — no image rebuild needed, just redeploy:

```bash
printf '%s' "NEW_VALUE" | gcloud secrets versions add DATABASE_URL --data-file=-
```

## 4. IAM

```bash
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
CLOUDBUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Cloud Build reads the build-time secrets (the NEXT_PUBLIC_* keys and DIRECT_URL).
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CLOUDBUILD_SA}" --role=roles/secretmanager.secretAccessor

# Cloud Run's runtime service account reads the mounted secrets.
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${RUNTIME_SA}" --role=roles/secretmanager.secretAccessor

# Cloud Build deploys the service...
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CLOUDBUILD_SA}" --role=roles/run.admin

# ...acting as the runtime service account.
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --member="serviceAccount:${CLOUDBUILD_SA}" --role=roles/iam.serviceAccountUser
```

## 5. First deploy

```bash
gcloud builds submit --config cloudbuild.yaml .
gcloud run services describe truckinggo --region "$REGION" --format='value(status.url)'
```

## 6. After the first deploy

1. **Firebase authorized domains** — add the Cloud Run URL under Firebase Console → Authentication →
   Settings → Authorized domains, or Google sign-in will be rejected.
2. **Cloud Scheduler** — create the auction-expiry job (see `docs/cloud-scheduler.md`, written in step A6).
3. Walk the release checklist in TechnicalDocument.md §9.7.

## Notes

- Do **not** attach a Cloud Build trigger on push to `main` while the two build lanes are running — they
  push every few minutes and each push would fire a deploy. Add the trigger once both lanes finish.
- `DEV_AUTH_BYPASS` must never be set on Cloud Run. The deploy above never sets it, `.dockerignore`
  keeps `.env*.local` out of the image, and `src/lib/session.ts` refuses to mock a session when
  `NODE_ENV=production` regardless (TechnicalDocument.md §4.4).
