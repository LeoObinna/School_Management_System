FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

# PostgreSQL 16 + Redis 7 as services inside the container
RUN sudo apt-get update && sudo apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    && sudo install -d /usr/share/postgresql/16/pgdg.sch \
    && sudo curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
       | sudo gpg --dearmor -o /usr/share/postgresql/16/pgdg.sch/postgresql.gpg \
    && echo "deb [signed-by=/usr/share/postgresql/16/pgdg.sch/postgresql.gpg] \
https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
       | sudo tee /etc/apt/sources.list.d/pgdg.list \
    && sudo apt-get update \
    && sudo apt-get install -y --no-install-recommends \
       postgresql-16 \
       redis-server \
    && sudo apt-get clean \
    && sudo rm -rf /var/lib/apt/lists/*
