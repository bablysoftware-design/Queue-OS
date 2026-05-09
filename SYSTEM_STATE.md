# Queue-OS Production State

## Stable Tag
stable-production-may9

## Current Status
- Customer queue working
- Voice notes upload working
- Voice note playback working
- Customer notes working
- Queue tracking working
- Shop dashboard working
- Marketplace working
- Cloudflare deployment working
- Git cleanup completed

## Deployment Flow

### Worker Deploy
cd worker
npx wrangler deploy

### Git Push
git add .
git commit -m "message"
git push origin main

## Important Production URLs

### Worker
https://saf-queue-worker.byker-software.workers.dev

### Frontend
(Add frontend URL)

## Important Notes
- Polling currently powers realtime
- Customer tracker interval = 8s
- Payment polling interval = 5s
- Voice uploads stored temporarily
- localStorage used heavily

## Known Risks
- API response inconsistency
- Polling scalability later
- localStorage stale state
- environment drift risk

## NEVER DO WITHOUT BACKUP
- SQL schema rewrite
- token state rewrite
- auth rewrite
- realtime rewrite

## Recovery
git checkout stable-production-may9