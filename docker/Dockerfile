FROM public.ecr.aws/i5t1k1k7/feditracker-worker-base:latest
COPY docker/settings.json /etc/transmission-daemon/settings.json
COPY docker/smb.conf /etc/samba/smb.conf
COPY docker/entrypoint.sh /app/entrypoint.sh

COPY . /app/express
WORKDIR /app/express
RUN npm ci
RUN npm run build
RUN chmod 777 /app/express/dist/done.js
RUN mkdir -p /var/www/html/downloads
RUN chown debian-transmission /var/www/html/downloads
RUN chgrp debian-transmission /var/www/html/downloads

RUN adduser --gecos "" --disabled-password vlc
RUN ["/usr/bin/bash", "-c", "chpasswd <<<\"vlc:vlc\""]
RUN (echo 'vlc'; echo 'vlc'; echo 'vlc') |  smbpasswd -s -a vlc

CMD ["sh", "/app/entrypoint.sh"]