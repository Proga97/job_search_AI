---
id: apply-assistant
title: Apply Assistant
description: Open job applications in a persistent local browser and safely autofill common contact fields.
sidebar_position: 9
---

## What it is

Apply Assistant is a small companion process that runs directly on your computer. Meow AI sends it the selected job link, the selected or base resume PDF, and the minimum contact details needed to fill common application fields. It opens a visible Chromium window, uploads the resume first when the page exposes a resume/CV control, waits for the ATS to parse it, fills the remaining fields it recognizes, and stops for your review.

It never clicks the final submit button.

## Why it exists

Meow AI normally runs inside Docker. A container cannot reliably control a visible macOS browser, so the companion runs on the Mac while the main application remains containerized. Its persistent browser profile keeps ATS sign-ins and cookies between applications.

## How to use it

1. From the project folder, install dependencies:

   ```bash
   npm install
   npx playwright install chromium
   ```

2. Start the companion in a separate Terminal window:

   ```bash
   npm run apply-assistant
   ```

3. Keep Docker and the companion running.
4. Open a job in Meow AI and click **Apply & Autofill**.
5. Confirm that the resume was attached, review every populated field, answer any remaining questions, and submit manually.

The default companion address is `http://127.0.0.1:4317`. Set `APPLY_ASSISTANT_URL` for the Meow AI container only if you use a different address. You can protect both sides with the same `APPLY_ASSISTANT_TOKEN` value.

## Common problems

### Apply Assistant is offline

Run `npm run apply-assistant` in a host Terminal window, not inside Docker. On first use, install Chromium with `npx playwright install chromium`.

### A field was not filled

The assistant uploads only the resume PDF and fills low-risk identity and contact fields. It leaves cover-letter and portfolio uploads, work authorization, sponsorship, demographic, compensation, and free-text questions untouched.

### A browser page is already signed in incorrectly

Close the companion, remove `.data/apply-assistant-browser` if you want a completely fresh browser profile, and restart it. Removing that folder signs the assistant browser out of saved sites.

## Related pages

- [Orchestrator](/docs/features/orchestrator)
- [Settings](/docs/features/settings)
- [Tracer Links](/docs/features/tracer-links)
