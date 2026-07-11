# Identity Reconciliation Service

A backend service for Zamazon.com that links orders placed with different
emails/phone numbers back to the same underlying customer — implemented as
a single `POST /identify` endpoint.
# Demo- https://youtu.be/-uurU6v6B9M
## Stack

- Node.js + Express
- PostgreSQL + Prisma ORM
- Docker / docker-compose
- Jest + Supertest for tests

## Project Structure

```
identity-reconciliation/
├── prisma/
│   ├── schema.prisma       # Contact model
│   └── seed.js             # optional sample data
├── src/
│   ├── controllers/        # request/response glue
│   ├── services/           # core reconciliation logic
│   ├── routes/
│   ├── middleware/         # validation + error handling
│   ├── utils/              # prisma client, logger, error classes
│   ├── app.js               # express app (no listen)
│   └── server.js            # entrypoint
├── tests/
├── Dockerfile
├── docker-compose.yml
└── postman_collection.json
```

## How it works

Every purchase carries an `email` and/or `phoneNumber`. A `Contact` row is
either `primary` (the canonical identity) or `secondary` (linked to a
primary via `linkedId`). On each request:

1. **No existing contact matches** → create a new `primary` contact.
2. **Matches an existing identity, with new info** (an email or phone not
   already on file for that person) → create a `secondary` contact linked
   to that identity's primary.
3. **Matches an existing identity, nothing new** → return the existing
   consolidated identity, no writes.
4. **Request bridges two previously-separate identities** (e.g. email
   belongs to cluster A, phone belongs to cluster B) → the two clusters
   merge. The **older** primary (by `createdAt`) remains primary; the
   younger primary is demoted to `secondary` and every contact under it is
   re-linked to the older primary.

All of this runs inside a single Prisma `$transaction` per request so
concurrent requests can't race each other into an inconsistent state.

### Response shape

```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["doc.brown@zamazon.com", "emmett.brown@zamazon.com"],
    "phoneNumbers": ["1234567890"],
    "secondaryContactIds": [2]
  }
}
```

`emails`/`phoneNumbers` always list the primary contact's own value first,
followed by the rest (deduplicated).

## Running locally (without Docker)

### Prerequisites
- Node.js 20+
- A running PostgreSQL instance

### Steps

```bash
git clone "https://github.com/Ayushgupta2408/identity-reconciliation"
cd identity-reconciliation
npm install

cp .env.example .env
# edit .env -> set DATABASE_URL to your local Postgres instance

#  Generate Prisma client + run migrations
npx prisma generate
npx prisma migrate dev --name init
npm run seed        # optional: adds sample contacts

npm run dev          # starts on http://localhost:3000
```

Test it:

```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "doc.brown@zamazon.com", "phoneNumber": "1234567890"}'
```

## Running with Docker (recommended)

This spins up Postgres + the app together, runs migrations automatically,
and exposes the API on port 3000.

```bash
docker-compose up --build
```

Once it's up:

```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "doc.brown@zamazon.com", "phoneNumber": "1234567890"}'
```

Stop it with `docker-compose down` (add `-v` to also drop the DB volume).

## Running tests

Tests run against a real database (they create/clean up their own rows).
Point `DATABASE_URL` in `.env` at a disposable/test database first.

```bash
npm test
```

Covers: new-contact creation, secondary creation on new info, no-op on
exact repeats, primary/primary merge on bridging requests, payload
validation, numeric `phoneNumber` normalization, and the health check.

## API Reference

### `POST /identify`

**Body**
| field | type | required |
|---|---|---|
| `email` | string | one of `email`/`phoneNumber` required |
| `phoneNumber` | string \| number | one of `email`/`phoneNumber` required |

**200 OK**
```json
{ "contact": { "primaryContactId": 1, "emails": [...], "phoneNumbers": [...], "secondaryContactIds": [...] } }
```

**400 Bad Request** — neither field supplied, or `email` fails format
validation:
```json
{ "error": "At least one of \"email\" or \"phoneNumber\" is required" }
```

**500** — unexpected server error. The response body intentionally omits
internal details (stack traces, DB errors); full context is logged
server-side only.

### `GET /health`

Returns `{ "status": "ok", "db": "connected" }` when the DB connection is
healthy, `503` otherwise. Used by the Docker `HEALTHCHECK` and can back a
Kubernetes liveness/readiness probe.

## Design notes / bonus coverage

- **Indexed lookups**: `email`, `phoneNumber`, and `linkedId` are all
  indexed in the Prisma schema, since every request does an `OR` lookup on
  the first two and cluster traversal relies on the third.
- **Transactional writes**: the entire identify flow (read → possible
  merge → possible create) happens inside one Prisma transaction, so two
  concurrent requests for the same person can't both slip through the
  "no match" branch and create duplicate primaries.
- **Defensive error responses**: validation errors return a precise
  message; anything else returns a generic message with no internal
  details, and full error context goes to server logs only — standard
  practice against information leakage to a probing client.
- **Rate limiting + Helmet + small body-size cap**: basic hardening for a
  publicly reachable endpoint.
- **Soft deletes**: the schema has `deletedAt` and all queries filter on
  `deletedAt: null`, so contacts can be archived without breaking
  historical links.

  # schema as suggested
  <img width="940" height="324" alt="image" src="https://github.com/user-attachments/assets/1d7bd83c-828e-4b0a-90fe-090ae3352aa9" />

# Work flow
<img width="2008" height="5076" alt="diagram" src="https://github.com/user-attachments/assets/6300442c-9e94-4bf2-bfde-ceec73c0dc4b" />

## License

MIT
