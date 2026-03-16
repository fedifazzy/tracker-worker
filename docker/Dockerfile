FROM node:18-slim AS builder

WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
COPY src ./src
RUN npm ci && npm run build

FROM node:18-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        ca-certificates \
        transmission-cli \
        transmission-common \
        transmission-daemon \
        samba && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/*

COPY docker/settings.json /etc/transmission-daemon/settings.json
COPY docker/entrypoint.sh /app/entrypoint.sh

WORKDIR /app/express
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

RUN chmod 777 dist/done.js && \
    mkdir -p /var/www/html/wd && \
    chown debian-transmission:debian-transmission /var/www/html/wd

RUN adduser --gecos "" --disabled-password vlc && \
    echo "vlc:vlc" | chpasswd

CMD ["sh", "/app/entrypoint.sh"]
