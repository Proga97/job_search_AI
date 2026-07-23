# Meow AI

Meow AI is Pranay Chimmani's local job-search workspace. It discovers US job listings, stores them locally, scores selected listings with an LLM, supports resume tailoring, tracks applications, and assists with application forms.

## Run locally

```bash
docker compose up -d --build
```

Open `http://localhost:3005` for the production container. For live frontend development, use the development Compose configuration and open `http://localhost:5173`.

Application data is persisted in the repository's `data/` directory. Back up that directory before migrations or major upgrades.

## Main workflow

1. Configure your profile and search criteria.
2. Fetch listings into the local database.
3. Review, filter, hide, or shortlist listings.
4. Run AI scoring manually when desired.
5. Tailor application materials and track submitted applications.

## Ownership

Meow AI is maintained by Pranay Chimmani.

Third-party packages, services, templates, and embedded components remain subject to their respective terms and license notices.

## Offline access licenses

The owner installation can issue username-bound, expiring access tokens from **Settings → Access Licenses**. The private Ed25519 issuer key is stored in the ignored `.license-private/` directory and must never be distributed or included in a friend-facing image.
