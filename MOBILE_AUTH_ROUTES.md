# Deprecated

> **This document is outdated.** Mobile auth now uses **OTP** (email one-time passwords), not email/password or Google OAuth.
>
> See [ROUTES.md — Authentication (OTP)](ROUTES.md#authentication-otp) for the current API.

---

# Mobile Auth Routes (legacy)

Scope: token-based mobile auth under `/api/v1/auth` from `app/controllers/users_controller.ts`.

**These routes are commented out in `start/routes.ts` and are not registered.**

## Response shape
- Successful JSON responses are wrapped by `ctx.serialize(...)`, so they return `{ data: ... }`.
- Auth payload shape:
  - `auth.user`: `{ id, email, fullName }`
  - `auth.token`: `{ type: 'bearer', value, expiresAt, abilities }`

## Routes (inactive)

| Method | Path | Input | Success response | Notable errors |
| --- | --- | --- | --- | --- |
| `POST` | `/api/v1/auth/signup` | `fullName` (nullable), `email`, `password`, `passwordConfirmation` | `201 Created` → `{ data: { auth: { user, token } } }` | `409 Conflict` if email already exists |
| `POST` | `/api/v1/auth/login` | `email`, `password` | `200 OK` → `{ data: { auth: { user, token } } }` | `401 Unauthorized` for invalid credentials |
| `POST` | `/api/v1/auth/forgot-password` | `email` | `204 No Content` | None returned by controller; validator may reject invalid input |
| `POST` | `/api/v1/auth/reset-password` | `token`, `password`, `passwordConfirmation` | `204 No Content` | `400 Bad Request` if token is invalid or expired |
| `GET` | `/api/v1/auth/google/redirect` | none | Redirect to Google OAuth | — |
| `GET` | `/api/v1/auth/google/callback` | Google callback query/state | `302 Redirect` to `MOBILE_OAUTH_DEEP_LINK` with `token`, `tokenType=bearer`, and optional `expiresAt`; otherwise `200 OK` → `{ data: { auth: { user, token } } }` | `400 Bad Request` for denied auth, bad state, provider error, or missing Google email |
| `POST` | `/api/v1/auth/logout` | bearer token via `api` auth guard | `204 No Content` | Unauthorized if no valid token |

## Notes
- `signup` and `login` mint an API token named `mobile` with `expiresIn: '30d'`.
- `googleCallback` mints an API token named `google-mobile` with `expiresIn: '30d'`.
- `logout` invalidates the current API token.
