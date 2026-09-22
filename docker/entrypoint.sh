#!/usr/bin/bash

if [ "$TORRENT_CLIENT" = "qbittorrent" ]; then
  mkdir -p /config/qBittorrent/config
  # Copied rather than mounted so a restart does not undo qBittorrent's own
  # edits to the file, and so the container starts with sane defaults once.
  [ -f /config/qBittorrent/config/qBittorrent.conf ] ||
    cp /etc/qBittorrent.conf /config/qBittorrent/config/qBittorrent.conf
  qbittorrent-nox --profile=/config --webui-port=8080 &
else
  service transmission-daemon start
fi

node /app/express/dist/index.js
