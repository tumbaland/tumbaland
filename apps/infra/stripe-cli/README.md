# Stripe CLI Dev Helper

Runs the Stripe CLI in a container to forward test mode webhooks to your local payment service.

## Files
- `docker-compose.yml` – launches stripe/stripe-cli and forwards events.
- `.env.stripe.example` – template; copy to `.env.stripe` and insert your `sk_test_...` key.

## Setup
1. Copy env file:
   ```bash
   cp .env.stripe.example .env.stripe
   ```
2. Edit `.env.stripe`:
   - Set `STRIPE_API_KEY=sk_test_...`
   - (Optional) adjust `FORWARD_TO` if your payment service runs elsewhere.
3. Ensure the external Docker network `tumbanet` exists (same one used by services). If not:
   ```bash
   docker network create tumbanet
   ```
4. Start listener:
   ```bash
   docker compose up -d
   ```
5. Check logs to see webhook signing secret (first run displays it):
   ```bash
   docker logs -f stripe-cli
   ```
   Look for: `Webhook endpoint secret: whsec_...`
6. Put that secret into `apps/backend/payment-service/.env` as `STRIPE_WEBHOOK_SECRET` and restart the payment service.

## Trigger Test Events
You can exec into the container or run ephemeral ones:
```bash
docker exec -it stripe-cli stripe trigger checkout.session.completed
```

## Filtering Events
Set `STRIPE_FORWARD_EVENTS` in `.env.stripe`, e.g.:
```
STRIPE_FORWARD_EVENTS=checkout.session.completed,invoice.payment_failed
```
(Will be added to command automatically if present in future enhancement.)

## Security
- Use only test keys here.
- Never commit real secrets. Add `.env.stripe` to root `.gitignore` if not already covered.

## Tear Down
```bash
docker compose down
```

## Next Enhancements
- Auto-inject `--events` when `STRIPE_FORWARD_EVENTS` set.
- Optional script to rotate webhook secret and update payment service.
