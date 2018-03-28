#!/usr/bin/env sh

ifconfig | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1'
python3 -m http.server 4433
python -m SimpleHTTPServer 4433
