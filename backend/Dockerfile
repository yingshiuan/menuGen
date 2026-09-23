# Build from the repo root, not ./backend:
#   docker build -f backend/Dockerfile .
# The renderer reads a few files out of the frontend (see "Frontend files" below),
# and a ./backend context cannot reach them. Render builds it the same way.
FROM node:20-bookworm-slim
WORKDIR /usr/src/app

# Install OS deps required by Puppeteer's Chromium. The CJK fonts are the
# fallback for Chinese: every PDF asks Google Fonts for Noto Sans TC/SC, and these
# cover a character missing from both, or a render where that stylesheet missed
# its budget. Without them either case prints boxes.
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y \
	ca-certificates \
	fonts-liberation \
      fonts-noto-cjk \
	fonts-wqy-zenhei \
	fonts-wqy-microhei \
	libnss3 \
	libx11-xcb1 \
	libxss1 \
	libasound2 \
	libatk1.0-0 \
	libgtk-3-0 \
	libxrandr2 \
	libxcomposite1 \
	libxcursor1 \
	libxdamage1 \
	libxfixes3 \
	libxrender1 \
	libdbus-1-3 \
	libpangocairo-1.0-0 \
	wget \
	chromium \
	--no-install-recommends && rm -rf /var/lib/apt/lists/*

# The apt chromium above is the browser that actually runs, so Puppeteer's
# bundled Chrome is dead weight -- and on arm64 it is worse than that: Chrome
# for Testing ships no linux-arm64 build, so the download is an x86-64 binary
# that cannot execute here at all. Skipping it drops ~1GB from the image.
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV CHROMIUM_PATH=/usr/bin/chromium

# Install production dependencies. --ignore-scripts is what actually suppresses
# the download, since the postinstall calls `puppeteer browsers install`
# explicitly and that command ignores PUPPETEER_SKIP_DOWNLOAD.
COPY backend/package*.json ./
RUN npm ci --only=production --ignore-scripts

# Copy source
COPY backend/ .

# Frontend files: pdfApp.js inlines frontend/public/css/tailwind.css into every
# render, and inlineLocalImages() reads any <img> given as a path (the sample
# menu's photo) from frontend/public. Both resolve to ../../frontend from here.
# Nothing is mounted on Render, so without this every PDF exports unstyled, with
# no error. The root .dockerignore lists which files make it in.
COPY frontend/public /usr/src/frontend/public

EXPOSE 3000
ENV NODE_ENV=production
CMD ["npm", "start"]
