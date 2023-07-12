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

### (not so) important notice

- I wouldn't mind being invited for a beer
