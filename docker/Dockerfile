FROM node:18-slim AS builder

WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
COPY src ./src
RUN npm ci && npm run build

FROM ubuntu:22.04

RUN apt-get update && \
    apt-get install -y --no-install-recommends software-properties-common && \
    add-apt-repository ppa:transmissionbt/ppa && \
    apt-get install -y --no-install-recommends \
        curl \
        transmission-cli \
        transmission-common \
        transmission-daemon \
        samba && \
    add-apt-repository --remove ppa:transmissionbt/ppa && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/*

COPY docker/settings.json /etc/transmission-daemon/settings.json
COPY docker/smb.conf /etc/samba/smb.conf
COPY docker/entrypoint.sh /app/entrypoint.sh

WORKDIR /app/express
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

RUN chmod 777 dist/done.js && \
    mkdir -p /var/www/html/downloads && \
    chown debian-transmission:debian-transmission /var/www/html/downloads

RUN adduser --gecos "" --disabled-password vlc && \
    echo "vlc:vlc" | chpasswd && \
    (echo 'vlc'; echo 'vlc') | smbpasswd -s -a vlc

CMD ["sh", "/app/entrypoint.sh"]
