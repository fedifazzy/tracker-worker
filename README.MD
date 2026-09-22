# Description

This application helps you to use Telegram [bot](https://t.me/feditracker_bot) with your computer as storage, e.g. home
media server.

# Requirements

- Docker installed. [Find it here](https://www.docker.com/products/docker-desktop/)

# Install

- Download me: `git clone https://github.com/fedifazzy/tracker-worker.git`
- Set your Telegram username in .env file as TG_USERNAME value
- Run `docker-compose build`

# Start

- Run `docker-compose up`
- Chat with Telegram [bot](https://t.me/feditracker_bot)

## Extended configuration (optional)

- You can change download directory in `docker-compose.yml` at `source`
- You can set autoupload you downloads to S3 storage. Just set `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET` and `S3_REGION`
  variables in .env. Uploaded files will be deleted from local computer

### Choosing a torrent client (optional)

The image carries both Transmission and qBittorrent. Transmission is used unless you set
`TORRENT_CLIENT=qbittorrent` in .env, and switching back is the same one line.

qBittorrent is what makes it possible to watch a torrent before it has finished: Debian
ships Transmission 3.00, which fetches pieces rarest-first, while qBittorrent downloads in
order and grabs the first and last pieces early. Set `SEQUENTIAL_DOWNLOAD=false` if you
would rather have the ordinary behaviour.

With qBittorrent selected, its web interface is on port 8080. **Set `QBT_PASSWORD`** (and
`QBT_USERNAME` if you want something other than `admin`) — the version in this image ships
with a default password that everybody knows, and the port is published to your network.
The worker applies the password itself on startup.

### Casting to a television (optional)

With `STREAM_HOST`, `STREAM_PORT` and `DLNA_RENDERER_URL` set, the bot can tell the worker
to start a torrent playing on a UPnP renderer on your network. The worker hands the
television a URL on its own stream server and the television pulls the bytes itself.

`STREAM_HOST` is the address your television should dial — your machine's address on the
local network. It cannot be worked out automatically: inside a container the worker only
sees its own address, which is not one anything else can reach.

`DLNA_RENDERER_URL` is the renderer's device description, something like
`http://192.168.0.23:16150/`. It is configured rather than discovered because discovery is
multicast and would not leave a bridged container. If your television stops answering
there after a reboot, it has probably picked a new port.

### Streaming to a player on your network (optional)

Set `STREAM_PORT` in .env — say `8765` — and the worker serves the files of any torrent it
holds over plain HTTP, at `http://<worker>:8765/t/<torrent-hash>/<file-index>`. Open that
in VLC, Kodi or any DLNA renderer on the same network.

A torrent that is still downloading works too: the final size comes from the torrent's
metadata, so a player treats it as an ordinary file it can seek around in, and a read that
reaches bytes which have not arrived yet waits for them instead of being served as zeros.
Reading straight off disk cannot do this — the file is preallocated, so the gaps read back
as silent zeros rather than as end-of-file.

Two things worth knowing before turning it on:

- **There is no authentication.** Keep the port on your LAN.
- Playback from an unfinished torrent only really works with the pieces arriving in order.
  Transmission gained sequential download in 4.1; on an older build, expect to stream only
  what has already finished.

### (not so) important notice

- I wouldn't mind being invited for a beer
