FROM ubuntu:22.04

# Dependencies from base image
RUN apt-get update --fix-missing
RUN apt-get install -y --fix-missing software-properties-common
RUN add-apt-repository ppa:transmissionbt/ppa
RUN apt-get install -y build-essential curl transmission-cli transmission-common transmission-daemon samba
RUN add-apt-repository --remove ppa:transmissionbt/ppa

WORKDIR /tmp
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
RUN apt-get install -y nodejs

# Original Dockerfile content
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