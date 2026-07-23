---
id: offline-access-licenses
title: Offline access licenses
description: Issue expiring, username-bound access tokens for local Meow AI installations.
sidebar_position: 12
---

## What it is

Meow AI can require an offline Ed25519-signed access token before a local installation can be used. Tokens contain a username, issue time, unique ID, and expiration date.

## Why it exists

Access licenses let the owner distribute Docker images selectively without maintaining a licensing server. The private signing key stays only on the owner's installation. Friend installations receive the public verification key and cannot issue tokens.

## How to use it

On the owner installation, enter the owner access token once on the activation
screen. This unlocks issuer/admin mode permanently for the persisted data
volume. Keep the owner token in the ignored `.license-private/owner-token`
file. You can alternatively provide it with the `MEOW_AI_OWNER_TOKEN`
environment variable.

Start the owner's installation with the issuer override:

```bash
docker compose -f docker-compose.yml -f docker-compose.issuer.yml up -d
```

For owner development with live reload, include both overrides:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.issuer.yml up -d --build
```

Ordinary installations must not use `docker-compose.issuer.yml`; they can run
`docker compose up -d --build` without any owner secrets.

Sign in as the system administrator, open **Settings → Access Licenses**, enter a username and expiration date, and select **Generate token**. Copy the resulting token to the intended user.

The user starts their local Meow AI installation, enters the same username on the activation screen, and pastes the token. The validated token is stored in their persistent `data/` directory.

To renew access, choose a new expiration date beside the username and select the refresh icon. Send the replacement token to the user.

## Common problems

- **Access Licenses is missing:** the private issuer key is not mounted, or the current account is not a system administrator.
- **Token belongs to another username:** the activation username must match the issued username, ignoring letter case.
- **Token expired:** issue a replacement from Settings with a future expiration date.
- **Issuer key is missing:** restore `.license-private/license-private.pem` from a secure backup. Never send this file to users or include it in a Docker image.

Offline tokens cannot be immediately revoked after distribution. Use short expiration periods when regular renewal is acceptable.

## Related pages

- [Self-hosting](/docs/getting-started/self-hosting)
- [Backups](/docs/features/backups)
