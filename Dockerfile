FROM node:16.14.2-slim

WORKDIR /workspace/development

COPY . gs_service/

RUN apt update && apt install rsync cmake g++ -y && rm -rf /var/cache/apt/* && rm -rf /var/log/apt && mv godspeed /usr/local/bin/ 