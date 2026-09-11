FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

# PHP 8.4 + extensions required by Laravel 12
RUN sudo apt-get update && sudo apt-get install -y --no-install-recommends \
    software-properties-common \
    ca-certificates \
    curl \
    git \
    unzip \
    libpq-dev \
    libpng-dev \
    libzip-dev \
    libxml2-dev \
    libcurl4-openssl-dev \
    libonig-dev \
    libicu-dev \
    && sudo add-apt-repository -y ppa:ondrej/php \
    && sudo apt-get update \
    && sudo apt-get install -y --no-install-recommends \
    php8.4-cli \
    php8.4-mbstring \
    php8.4-xml \
    php8.4-curl \
    php8.4-zip \
    php8.4-pgsql \
    php8.4-mysql \
    php8.4-sqlite3 \
    php8.4-bcmath \
    php8.4-intl \
    php8.4-gd \
    php8.4-opcache \
    php8.4-redis \
    php8.4-fpm \
    && sudo apt-get clean \
    && sudo rm -rf /var/lib/apt/lists/*

# Composer
RUN sudo curl -sS https://getcomposer.org/installer | sudo php -- --install-dir=/usr/local/bin --filename=composer

# Node.js 24 (for Vite / Vue build)
ENV NODE_MAJOR=24
RUN sudo mkdir -p /etc/apt/keyrings \
    && sudo curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repos.keyring.gpg | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list \
    && sudo apt-get update \
    && sudo apt-get install -y nodejs \
    && sudo npm install -g npm@latest

# GitHub CLI
RUN sudo curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && sudo apt-get update \
    && sudo apt-get install -y gh

# PHP configuration for development
RUN sudo cp /etc/php/8.4/cli/php.ini /etc/php/8.4/cli/php.ini.orig \
    && echo "memory_limit = 512M" | sudo tee -a /etc/php/8.4/cli/php.ini \
    && echo "upload_max_filesize = 50M" | sudo tee -a /etc/php/8.4/cli/php.ini \
    && echo "post_max_size = 50M" | sudo tee -a /etc/php/8.4/cli/php.ini
