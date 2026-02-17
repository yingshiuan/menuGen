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

Build and run the dev services which mount your local source into the containers for live edits:

```bash
cd /path/to/menu-gen
docker compose up --build backend-dev frontend-dev
```

- Frontend dev server: http://localhost:5173
- Backend dev server: http://localhost:3000

## Useful commands

```bash
# Rebuild and run a single service and stream logs
docker compose up --build backend-dev

# Follow logs for both dev services
docker compose logs -f backend-dev frontend-dev

# Stop all running services
docker compose down
```

## Notes

- Puppeteer requires system libraries and fonts to render PDFs. The backend images include Chromium and common runtime libs. If you have a custom Chromium binary, set `CHROMIUM_PATH` in the service environment to its path.
- For Chinese (CJK) text rendering in PDFs, ensure CJK fonts are installed in the image (e.g. `fonts-noto-cjk`, `fonts-wqy-zenhei`). The current backend images attempt to include fonts; if characters don't render, add the desired font and rebuild.
