FROM node:16.15.0-slim

WORKDIR /workspaces

RUN apt update && apt install rsync cmake g++ -y && rm -rf /var/cache/apt/* && rm -rf /var/log/apt 

COPY . gs_service/

