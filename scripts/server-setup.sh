#!/bin/bash

# LGS Admin Panel - DigitalOcean Server Setup Script
# This script prepares a fresh Ubuntu 20.04+ server for deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    error "Please run this script as root or with sudo"
fi

log "Starting LGS Admin Panel server setup..."

# Update system
log "Updating system packages..."
apt update && apt upgrade -y
success "System updated"

# Install essential packages
log "Installing essential packages..."
apt install -y curl wget gnupg2 software-properties-common apt-transport-https ca-certificates

# Install Node.js 18
log "Installing Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs
success "Node.js $(node --version) installed"

# Install MongoDB
log "Installing MongoDB..."
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/6.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-6.0.list
apt-get update
apt-get install -y mongodb-org

# Start and enable MongoDB
systemctl start mongod
systemctl enable mongod
success "MongoDB installed and started"

# Install PM2
log "Installing PM2..."
npm install -g pm2
success "PM2 installed"

# Install Nginx
log "Installing Nginx..."
apt install -y nginx
systemctl start nginx
systemctl enable nginx
success "Nginx installed and started"

# Install Certbot for SSL
log "Installing Certbot..."
apt install -y certbot python3-certbot-nginx
success "Certbot installed"

# Create application directory
log "Creating application directories..."
mkdir -p /var/www/lgs-admin-panel
mkdir -p /var/log/lgs-admin
mkdir -p /var/log/pm2
mkdir -p /var/backups/lgs-admin

# Set permissions
chown -R www-data:www-data /var/www/lgs-admin-panel
chown -R www-data:www-data /var/log/lgs-admin

success "Directories created"

# Configure MongoDB
log "Configuring MongoDB..."
cat > /etc/mongod.conf << 'EOF'
# mongod.conf

# for documentation of all options, see:
#   http://docs.mongodb.org/manual/reference/configuration-options/

# Where to store the data.
storage:
  dbPath: /var/lib/mongodb
  journal:
    enabled: true

# where to write logging data.
systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log

# network interfaces
net:
  port: 27017
  bindIp: 127.0.0.1

# how the process runs
processManagement:
  timeZoneInfo: /usr/share/zoneinfo

#security:
#  authorization: enabled

#replication:

#sharding:

## Enterprise-Only Options:

#auditLog:

#snmp:
EOF

systemctl restart mongod
success "MongoDB configured"

# Create MongoDB admin user
log "Creating MongoDB admin user..."
mongosh << 'EOF'
use admin
db.createUser({
  user: "admin",
  pwd: "admin123",
  roles: [ { role: "userAdminAnyDatabase", db: "admin" }, "readWriteAnyDatabase" ]
})

use lgs_admin
db.createUser({
  user: "lgs_user",
  pwd: "lgs_password_123",
  roles: [ { role: "readWrite", db: "lgs_admin" } ]
})
EOF

success "MongoDB users created"

# Configure Nginx
log "Configuring Nginx..."
cat > /etc/nginx/sites-available/lgs-admin << 'EOF'
server {
    listen 80;
    server_name admin.letsgo-speak.com www.admin.letsgo-speak.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name admin.letsgo-speak.com www.admin.letsgo-speak.com;

    # SSL Configuration (will be managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/admin.letsgo-speak.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.letsgo-speak.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

    # Main application
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # API rate limiting
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Login rate limiting
    location /api/auth/ {
        limit_req zone=login burst=5 nodelay;
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files caching
    location /_next/static/ {
        proxy_pass http://localhost:3001;
        proxy_cache_valid 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security.txt
    location /.well-known/security.txt {
        return 200 "Contact: security@letsgo-speak.com\nExpires: 2025-12-31T23:59:59.000Z\n";
        add_header Content-Type text/plain;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3001;
        access_log off;
    }

    # Logs
    access_log /var/log/nginx/lgs-admin-access.log;
    error_log /var/log/nginx/lgs-admin-error.log;
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/lgs-admin /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
nginx -t
systemctl reload nginx

success "Nginx configured"

# Configure firewall
log "Configuring firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
success "Firewall configured"

# Configure log rotation
log "Setting up log rotation..."
cat > /etc/logrotate.d/lgs-admin << 'EOF'
/var/log/lgs-admin/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 www-data www-data
    postrotate
        systemctl reload nginx > /dev/null 2>&1 || true
    endscript
}

/var/log/pm2/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
    postrotate
        pm2 reloadLogs > /dev/null 2>&1 || true
    endscript
}
EOF

success "Log rotation configured"

# Create backup script
log "Creating backup script..."
cat > /usr/local/bin/lgs-backup.sh << 'EOF'
#!/bin/bash

# LGS Admin Panel Backup Script
BACKUP_DIR="/var/backups/lgs-admin"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
APP_DIR="/var/www/lgs-admin-panel"

# Create backup directory
mkdir -p $BACKUP_DIR/database
mkdir -p $BACKUP_DIR/application

# Backup MongoDB
mongodump --host localhost --port 27017 --db lgs_admin --out $BACKUP_DIR/database/mongo_$TIMESTAMP

# Backup application files
tar -czf $BACKUP_DIR/application/app_$TIMESTAMP.tar.gz -C $APP_DIR .

# Keep only last 7 days of backups
find $BACKUP_DIR -type f -mtime +7 -delete
find $BACKUP_DIR -type d -empty -delete

echo "Backup completed: $TIMESTAMP"
EOF

chmod +x /usr/local/bin/lgs-backup.sh

# Setup cron job for backups
echo "0 2 * * * /usr/local/bin/lgs-backup.sh >> /var/log/lgs-admin/backup.log 2>&1" | crontab -

success "Backup script created and scheduled"

# Create monitoring script
log "Creating monitoring script..."
cat > /usr/local/bin/lgs-monitor.sh << 'EOF'
#!/bin/bash

# LGS Admin Panel Monitoring Script
LOG_FILE="/var/log/lgs-admin/monitor.log"
TIMESTAMP=$(date +'%Y-%m-%d %H:%M:%S')

# Check if application is running
if ! pm2 list | grep -q "lgs-admin-panel.*online"; then
    echo "[$TIMESTAMP] ERROR: LGS Admin Panel is not running" >> $LOG_FILE
    pm2 restart lgs-admin-panel >> $LOG_FILE 2>&1
fi

# Check if MongoDB is running
if ! systemctl is-active --quiet mongod; then
    echo "[$TIMESTAMP] ERROR: MongoDB is not running" >> $LOG_FILE
    systemctl start mongod >> $LOG_FILE 2>&1
fi

# Check if Nginx is running
if ! systemctl is-active --quiet nginx; then
    echo "[$TIMESTAMP] ERROR: Nginx is not running" >> $LOG_FILE
    systemctl start nginx >> $LOG_FILE 2>&1
fi

# Check disk space
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 85 ]; then
    echo "[$TIMESTAMP] WARNING: Disk usage is at ${DISK_USAGE}%" >> $LOG_FILE
fi

# Check memory usage
MEMORY_USAGE=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
if [ $MEMORY_USAGE -gt 90 ]; then
    echo "[$TIMESTAMP] WARNING: Memory usage is at ${MEMORY_USAGE}%" >> $LOG_FILE
fi
EOF

chmod +x /usr/local/bin/lgs-monitor.sh

# Setup cron job for monitoring
echo "*/5 * * * * /usr/local/bin/lgs-monitor.sh" | crontab -

success "Monitoring script created and scheduled"

# Display summary
log "Server setup completed successfully!"
echo ""
echo -e "${GREEN}=== SETUP SUMMARY ===${NC}"
echo -e "✅ System updated"
echo -e "✅ Node.js $(node --version) installed"
echo -e "✅ MongoDB installed and configured"
echo -e "✅ PM2 installed"
echo -e "✅ Nginx installed and configured"
echo -e "✅ Certbot installed (SSL ready)"
echo -e "✅ Firewall configured"
echo -e "✅ Log rotation configured"
echo -e "✅ Backup script created (runs daily at 2 AM)"
echo -e "✅ Monitoring script created (runs every 5 minutes)"
echo ""
echo -e "${YELLOW}=== NEXT STEPS ===${NC}"
echo -e "1. Configure your domain DNS to point to this server"
echo -e "2. Generate SSL certificate: certbot --nginx -d admin.letsgo-speak.com"
echo -e "3. Deploy your application using: ./scripts/deploy.sh production"
echo -e "4. Update MongoDB passwords in production"
echo ""
echo -e "${BLUE}=== USEFUL COMMANDS ===${NC}"
echo -e "• Check services: systemctl status nginx mongod"
echo -e "• View PM2 apps: pm2 status"
echo -e "• Monitor PM2: pm2 monit"
echo -e "• View logs: pm2 logs lgs-admin-panel"
echo -e "• Check backups: ls -la /var/backups/lgs-admin/"
echo -e "• Manual backup: /usr/local/bin/lgs-backup.sh"
echo ""
success "Server is ready for deployment!"