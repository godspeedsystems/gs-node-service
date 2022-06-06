FROM node:16.14.2-slim

WORKDIR /workspace/development

RUN apt update && apt install rsync cmake g++ sudo -y && echo '%sudo ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers && rm -rf /var/cache/apt/* && rm -rf /var/log/apt  

COPY . gs_service/

