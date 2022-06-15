FROM node:16.14.2-slim


RUN apt update && apt install rsync cmake g++ sudo -y && echo '%sudo ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers && rm -rf /var/cache/apt/* && rm -rf /var/log/apt && usermod -G sudo node 

USER node
RUN sudo mkdir -p /workspace/development && sudo chown  -R node:node /workspace
WORKDIR /workspace/development
COPY --chown=node:node . gs_service/

