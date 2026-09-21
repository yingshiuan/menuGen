# Docker

Run the full stack using Docker Compose. The repo includes production and development services.

## Production

Build and run frontend and backend images (frontend served by Nginx):

```bash
cd /path/to/menu-gen
docker compose up --build backend frontend
```

- Frontend: http://localhost:8080
- Backend: http://localhost:3000

## Development (live reload)

Build and run the dev services which mount your local source into the containers for live edits.

Recommended (separate dev compose file):

```bash
cd /path/to/menu-gen
docker compose -f docker-compose.dev.yml up --build backend-dev frontend-dev
```

Alternative (single `docker-compose.yml` containing dev services):

```bash
cd /path/to/menu-gen
docker compose up --build backend-dev frontend-dev
```

- Frontend dev server: http://localhost:5173
- Backend dev server: http://localhost:3000

## Useful commands

```bash
# Rebuild and run a single dev service (using dev compose file)
docker compose -f docker-compose.dev.yml up --build backend-dev

# Follow logs for both dev services
docker compose -f docker-compose.dev.yml logs -f backend-dev frontend-dev

# Stop all running services
docker compose -f docker-compose.dev.yml down

# (If you kept dev services in the main file and prefer Compose profiles)
# Start prod services only:
docker compose up --build backend frontend
# Start dev services with profile (if configured):
docker compose --profile dev up --build
```

## Notes

- PDFs are styled with `frontend/public/css/tailwind.css`, a prebuilt copy of the app's CSS (the backend has no Vite). You don't need to rebuild it by hand:
  - the frontend dev server (local or `frontend-dev`) rebuilds it whenever a file in `frontend/src` changes, and the backend rereads it on the next PDF, with no restart;
  - CI rebuilds it on every push to `main` and commits it if it was out of date (a pull request only gets a warning);
  - to rebuild it yourself: `npm run build:css` in `frontend/`.
- Puppeteer requires system libraries and fonts to render PDFs. The backend images include Chromium and common runtime libs. If you have a custom Chromium binary, set `CHROMIUM_PATH` in the service environment to its path.
  -- For Chinese (CJK) text rendering in PDFs, ensure CJK fonts are installed in the image (e.g. `fonts-noto-cjk`, `fonts-wqy-zenhei`). The current backend images attempt to include fonts; if characters don't render, add the desired font and rebuild.

-- Notes on profiles vs separate files: keeping a separate `docker-compose.dev.yml` avoids accidental starts of dev services in production and is clearer for local development; using Compose profiles keeps a single file but requires tagging dev services with `profiles: ["dev"]` and using `--profile dev` to start them.
