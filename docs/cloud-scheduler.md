# Cloud Scheduler — auction expiry sweep

`POST /api/cron` flips every `ACTIVE` auction whose `endTime` has passed to `CLOSED_EXPIRED`
(TechnicalDocument.md §5.5). Nothing in the app calls it; Cloud Scheduler does.

**Why it exists at all.** Nothing else in the system notices time passing. A shipper's dashboard and a
carrier's feed both filter on `endTime > now`, so an un-swept auction is already invisible to users — but
its row still reads `ACTIVE`, and "My Bids" would show those bids as *Pending* forever. The sweep is what
turns "the deadline passed" into a fact in the database.

---

## 1. The secret

```bash
# Generate once. Any high-entropy string; 32 bytes base64 is plenty.
openssl rand -base64 32 | tr -d '\n' | gcloud secrets create CRON_SECRET --data-file=-

# Let Cloud Run read it at runtime (cloudbuild.yaml already mounts it).
gcloud secrets add-iam-policy-binding CRON_SECRET \
  --member="serviceAccount:$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

`CRON_SECRET` is a **runtime** secret. It must never be a Docker build arg, never carry a `NEXT_PUBLIC_`
prefix, and never appear in `cloudbuild.yaml` (CLAUDE.md §9).

⚠️ **If `CRON_SECRET` is unset, the route rejects every request rather than running unauthenticated.**
That is deliberate — a missing env var must not turn this into an open "close every auction" button — but
it also means a forgotten secret looks exactly like a working schedule that never closes anything. If
auctions stop expiring, check this first.

---

## 2. The job

```bash
gcloud scheduler jobs create http truckinggo-auction-sweep \
  --location=asia-south1 \
  --schedule="* * * * *" \
  --time-zone="Etc/UTC" \
  --uri="https://<CLOUD_RUN_URL>/api/cron" \
  --http-method=POST \
  --headers="Authorization=Bearer $(gcloud secrets versions access latest --secret=CRON_SECRET)" \
  --attempt-deadline=60s \
  --max-retry-attempts=3 \
  --min-backoff=10s \
  --max-backoff=60s
```

**Every minute.** §5.5 accepts up to 60s of lag between a deadline and the row changing, and that lag is
harmless by design: `submitBid` guard 4 re-checks `endTime` on every write, so an auction that is expired
but still reads `ACTIVE` already rejects bids. The sweep is bookkeeping, not enforcement.

**Retries are safe.** The sweep is a single `updateMany` whose `WHERE` is the entire decision, so a repeat
run matches nothing and returns `{ closed: 0 }`. There is no state to corrupt by running it twice, which is
why the retry policy above is unapologetic.

**It cannot un-assign a won auction.** The filter requires `status: 'ACTIVE'`, and `acceptBid` has already
flipped the winner's auction to `COMPLETED_ASSIGNED` — so the two can never claim the same row. That is the
same guard from both directions, and `src/lib/__tests__/auction-close.test.ts` pins it.

### Updating the header after rotating the secret

The header is baked into the job, so rotating `CRON_SECRET` requires updating both:

```bash
gcloud scheduler jobs update http truckinggo-auction-sweep \
  --location=asia-south1 \
  --update-headers="Authorization=Bearer $(gcloud secrets versions access latest --secret=CRON_SECRET)"
```

Rotate the secret **first**, redeploy Cloud Run, then update the job — in that order the worst case is a
minute of 401s. The other order leaves the endpoint accepting a secret that is no longer current.

---

## 3. Verifying it

```bash
# Force a run.
gcloud scheduler jobs run truckinggo-auction-sweep --location=asia-south1

# Recent outcomes.
gcloud logging read \
  'resource.type="cloud_scheduler_job" AND resource.labels.job_id="truckinggo-auction-sweep"' \
  --limit=10 --format='value(timestamp,severity,textPayload)'
```

By hand:

```bash
curl -i -X POST "https://<CLOUD_RUN_URL>/api/cron" \
  -H "Authorization: Bearer $(gcloud secrets versions access latest --secret=CRON_SECRET)"
# → 200 {"closed":2}   first run after some auctions expired
# → 200 {"closed":0}   immediately after — idempotent

curl -i -X POST "https://<CLOUD_RUN_URL>/api/cron"
# → 401 {"error":"Unauthorized"}
```

| Symptom | Cause |
|---|---|
| Always `401` | `CRON_SECRET` unset in Cloud Run, or the job's header is from an older version |
| Always `{"closed":0}` while auctions visibly expire | Job pointing at a stale revision URL, or the secret mismatched so it never got past the check |
| `404` | `/api/cron` is the one path middleware must let through unauthenticated — check `src/middleware.ts` |
| Timeouts on a cold start | Expected occasionally at `--min-instances=0`; the retry covers it |
