#!/usr/bin/bash

service transmission-daemon start
service smbd start
node /app/express/dist/index.js