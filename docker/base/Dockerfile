FROM ubuntu:22.04

RUN apt-get update --fix-missing
RUN apt-get install -y --fix-missing software-properties-common
RUN add-apt-repository ppa:transmissionbt/ppa
RUN apt-get install -y build-essential curl transmission-cli transmission-common transmission-daemon
RUN add-apt-repository --remove ppa:transmissionbt/ppa
WORKDIR /tmp
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
RUN apt-get install -y nodejs
