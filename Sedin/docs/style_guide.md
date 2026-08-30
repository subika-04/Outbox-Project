# Reference ZIP Coding Style Guide

This document captures the conventions and architectural style observed in the reference project (`HomeBakerConnect-main`) to ensure styling consistency in the ReachInbox Email Scheduler.

## Backend Styling Guidelines

1. **Folder Conventions**:
   - `controller/`: Request handlers grouped by business subdomain (e.g., `controller/authentication/authController.js`).
   - `middleware/`: Auth gates and error handling handlers.
   - `models/`: Database entities and schemas.
   - `routes/`: Express router definitions.
   - `server.js`: App bootstrapper (Express initialization, MongoDB connection, routes setup, global error middleware).

2. **Code & API Conventions**:
   - Controller functions export handlers as properties (e.g., `exports.login = async (req, res) => { ... }`).
   - JSON responses follow a simple `{ message, ...data }` payload format.
   - Error blocks return the status code `400` or `500` with the error message in the payload: `res.status(400).json({ message: error.message })`.

## Frontend Styling Guidelines

1. **Routing and Structure**:
   - Routing defined inside `App.jsx` using `react-router-dom`.
   - Layout grids and common views separated into logical components.
   - Local state used extensively (`useState`) for form management.
   - CSS properties kept in individual styling sheets under a `/css` directory.

2. **HTTP Requests**:
   - API interactions are driven by `axios`.
   - Storing session credentials or tokens inside `localStorage`.

---

## Conflict Resolutions & Adaptations for ReachInbox

Because of the strict architectural specifications, the ReachInbox Email Scheduler will adapt these style patterns with the following upgrades:
- **TypeScript Transition**: We replace raw JavaScript/CommonJS with TypeScript (Strict mode enabled, ES6 Modules). All controllers and models will be strongly typed.
- **ORM & MySQL**: Prisma ORM replaces Mongoose/MongoDB. Prisma schemas will be stored in `/prisma/schema.prisma`.
- **Signed Session Cookies**: Raw `localStorage` token storage is replaced with HTTP-only, secure, signed session cookies. The frontend client will be configured with `withCredentials: true` to support transparent cookie transmission.
