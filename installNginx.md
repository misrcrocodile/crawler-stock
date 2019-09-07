# 1. install Nginx
```
sudo apt-get update
sudo apt-get install nginx
sudo nginx -v
nginx version: nginx/1.6.2
```

# 2. Nginx folder structure
https://wiki.debian.org/Nginx/DirectoryStructure#A.2Fetc.2Fnginx.2F
```
Contents

Nginx Web Server / Directory Structure
  /etc/nginx/
  /etc/nginx/nginx.conf
  /etc/nginx/conf.d/*.conf
Extra Parameters
  Packaged Applications
  upstream providers
  init
  uwsgi

```

# 3. Settings
```
user www-data;
worker_processes 4;
pid /run/nginx.pid;

events {
    worker_connections 768;
    # multi_accept on;
}

http {

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    # server_tokens off;

    # server_names_hash_bucket_size 64;
    # server_name_in_redirect off;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    gzip on;
    gzip_disable "msie6";

    # gzip_vary on;
    # gzip_proxied any;
    # gzip_comp_level 6;
    # gzip_buffers 16 8k;
    # gzip_http_version 1.1;
    # gzip_types text/plain text/css application/json application/x-javascript text/xml application/xml application/xml+rss text/javascript;

    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
```

# 4. Start nginx Server
```
sudo service nginx start
service nginx reload
service nginx status
```




```
# Update the repository and then install nginx using the apt command below.
sudo apt update
sudo apt install nginx -y

# Add the SSH service port to the firewall configuration using the ufw command and then enable the UFW firewall service.
ufw allow ssh
ufw enable

# Now add the HTTP and HTTPS services.
ufw allow http
ufw allow https

# The SSH, HTTP, and HTTPS service ports have been added to the UFW Firewall service list, check it's using the command below.
ufw status

# Install the letsencrypt packages using the apt command below.
sudo apt install letsencrypt -y


# Go to the '/etc/nginx' configuration directory and create new configuration file 'cerbot.conf' under the 'snippets' directory.
cd /etc/nginx/
vim snippets/certbot.conf

# Paste the following configuration there.
location /.well-known {
    alias /var/www/html/.well-known;
}

# Now edit the default Nginx virtual host file.
vim sites-available/default

# Add following configuration under the 'server {..}' blocks.
include snippets/certbot.conf;


# Next, generate the SSL letsencrypt certificates using the certbot command.
certbot certonly --rsa-key-size 4096 --webroot --agree-tos --no-eff-email --email misr.crocodile@gmail.com -w /var/www/html -d misr.xyz

# To get an additional security, we will generate the DHPARAM key '4096' using the OpenSSL command as shown below.
openssl dhparam -out /etc/nginx/dhparam.pem 4096

# SSL Configuration
cd /etc/nginx/
vim snippets/ssl.conf

#Paste the following SSL configuration there.

###################################################################
# Specify the TLS versions
ssl_protocols TLSv1 TLSv1.1 TLSv1.2;
ssl_prefer_server_ciphers on;

# Ciphersuites recommendation from the chiper.li
# Use this chipersuites to get 100 points of the SSLabs test
# Some device will not support
#ssl_ciphers "ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-SHA384";

# Mozilla Ciphersuits Recommendation
# Use this for all devices supports
ssl_ciphers 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-SHA384:ECDHE-RSA-AES256-SHA384:ECDHE-ECDSA-AES128-SHA256:ECDHE-RSA-AES128-SHA256';

# Use the DHPARAM key and ECDH curve >= 256bit
ssl_ecdh_curve secp384r1;
ssl_dhparam /etc/nginx/dhparam.pem;

server_tokens off;
ssl_session_timeout 1d;
ssl_session_cache shared:SSL:50m;
ssl_session_tickets off;

# Enable HTTP Strict-Transport-Security
# If you have a subdomain of your site,
# be carefull to use the 'includeSubdomains' options
add_header Strict-Transport-Security "max-age=63072000; includeSubdomains; preload";

# Enable OSCP Stapling for Nginx web server
# If you're using the SSL from Letsencrypt,
# use the 'chain.pem' certificate
ssl_stapling on;
ssl_stapling_verify on;
ssl_trusted_certificate /etc/letsencrypt/live/misr.xyz/chain.pem;
resolver 8.8.8.8 8.8.4.4 valid=300s;
resolver_timeout 5s;

# XSS Protection for Nginx web server
add_header X-Frame-Options DENY;
add_header X-XSS-Protection "1; mode=block";
add_header X-Content-Type-Options nosniff;
add_header X-Robots-Tag none;
############################################################



# Configure Nginx Virtual Host with SSL

# Create the new directory '/var/www/site01' and create the 'index.html' file inside.
mkdir -p /var/www/site01
echo '<h1><center>Nginx - Letsencrypt - A+</center></h1>' > /var/www/site01/index.html

cd /etc/nginx/
vim sites-available/hakase-labs.io

# Paste the following sample Nginx virtual host configuration there.

server {
  listen 80;
  listen [::]:80;
  server_name hakase-labs.io;

  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;

  root   /var/www/site01;
  index index.html index.php index.htm;

  server_name  hakase-labs.io;
  error_log /var/log/nginx/hakase-error.log warn;

  ssl_certificate /etc/letsencrypt/live/hakase-labs.io/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/hakase-labs.io/privkey.pem;

  #SSL Configuration
  include snippets/ssl.conf;

  location ~ /.well-known {
    allow all;
  }


  location / {
    try_files $uri $uri/ =404;
  }


  location = /favicon.ico {
    log_not_found off;
    access_log off;
  }

  location = /robots.txt {
    allow all;
    log_not_found off;
    access_log off;
  }

  location ~* \.(js|css|png|jpg|jpeg|gif|ico)$ {
    expires max;
    log_not_found off;
  }

}


# Enable the new virtual host file and test the configuration, and make sure there is no error.
ln -s /etc/nginx/sites-available/hakase-labs.io /etc/nginx/sites-enabled/
nginx -t

# Now restart the nginx service.
systemctl restart nginx

# The new virtual host with the HTTPS enabled and an additional SSL configuration has been created.
# Check using the netstat command and you will get the HTTPS port 443 on the list.
netstat -plntu
```