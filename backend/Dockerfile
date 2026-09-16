FROM node:20-bookworm-slim
WORKDIR /usr/src/app

# Install OS deps required by Puppeteer's Chromium
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
COPY package*.json ./
RUN npm ci --only=production --ignore-scripts

# Copy source
COPY . .

EXPOSE 3000
ENV NODE_ENV=production
CMD ["npm", "start"]
