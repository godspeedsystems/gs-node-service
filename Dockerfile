FROM node:16.14.2-slim

WORKDIR /usr/src/app

RUN mkdir -p /usr/src/app/gs_service/project  && mkdir -p /usr/src/app/gs_service/build && apt update \
     && apt install rsync cmake g++ -y && rm -rf /var/cache/apt/* && rm -rf /var/log/apt

COPY . gs_service/

