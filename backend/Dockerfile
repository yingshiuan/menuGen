FROM node:20-bullseye-slim
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

# Install production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "server.js"]
