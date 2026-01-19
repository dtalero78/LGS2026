#!/bin/bash

# LGS Admin Panel - Deployment Script for DigitalOcean
# Usage: ./scripts/deploy.sh [environment]
# Example: ./scripts/deploy.sh production

set -e

# Configuration
ENVIRONMENT=${1:-production}
SERVER_USER="root"
SERVER_HOST="your-server-ip"
APP_DIR="/var/www/lgs-admin-panel"
BACKUP_DIR="/var/backups/lgs-admin"
SERVICE_NAME="lgs-admin-panel"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
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

# Check if server host is configured
if [ "$SERVER_HOST" = "your-server-ip" ]; then
    error "Please configure SERVER_HOST in the deployment script"
fi

# Pre-deployment checks
log "Starting deployment to $ENVIRONMENT environment..."

# Check if required files exist
if [ ! -f "package.json" ]; then
    error "package.json not found. Make sure you're in the project root directory."
fi

if [ ! -f ".env.$ENVIRONMENT" ]; then
    error ".env.$ENVIRONMENT file not found. Please create it before deployment."
fi

# Build the application locally
log "Building application locally..."
npm run build || error "Build failed"

# Create deployment package
log "Creating deployment package..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PACKAGE_NAME="lgs-admin-panel-$TIMESTAMP.tar.gz"

tar -czf $PACKAGE_NAME \
    --exclude=node_modules \
    --exclude=.git \
    --exclude=.next \
    --exclude=logs \
    --exclude="*.tar.gz" \
    .

success "Package created: $PACKAGE_NAME"

# Deploy to server
log "Connecting to server and deploying..."

ssh $SERVER_USER@$SERVER_HOST << EOF
    set -e

    # Create necessary directories
    mkdir -p $APP_DIR
    mkdir -p $BACKUP_DIR
    mkdir -p /var/log/lgs-admin
    mkdir -p /var/log/pm2

    # Backup current deployment if it exists
    if [ -d "$APP_DIR/.next" ]; then
        echo "Creating backup of current deployment..."
        tar -czf $BACKUP_DIR/backup-$TIMESTAMP.tar.gz -C $APP_DIR .
        echo "Backup created: $BACKUP_DIR/backup-$TIMESTAMP.tar.gz"
    fi

    # Stop the application
    echo "Stopping application..."
    pm2 stop $SERVICE_NAME 2>/dev/null || echo "Service was not running"

    echo "Deployment directory prepared"
EOF

# Copy files to server
log "Uploading files to server..."
scp $PACKAGE_NAME $SERVER_USER@$SERVER_HOST:/tmp/

# Continue deployment on server
ssh $SERVER_USER@$SERVER_HOST << EOF
    set -e

    # Extract files
    echo "Extracting application files..."
    cd $APP_DIR
    tar -xzf /tmp/$PACKAGE_NAME
    rm /tmp/$PACKAGE_NAME

    # Install dependencies
    echo "Installing dependencies..."
    npm ci --only=production

    # Copy environment file
    cp .env.$ENVIRONMENT .env.local

    # Build application on server
    echo "Building application..."
    npm run build

    # Set proper permissions
    chown -R www-data:www-data $APP_DIR
    chmod -R 755 $APP_DIR

    # Setup PM2 if not already running
    if ! command -v pm2 &> /dev/null; then
        echo "Installing PM2..."
        npm install -g pm2
    fi

    # Start/restart the application
    echo "Starting application with PM2..."
    cd $APP_DIR
    pm2 start ecosystem.config.js --env production || pm2 restart $SERVICE_NAME
    pm2 save

    # Setup PM2 startup script (only run once)
    pm2 startup systemd -u $USER --hp $HOME 2>/dev/null || echo "PM2 startup already configured"

    echo "Deployment completed successfully!"
EOF

# Cleanup local package
rm $PACKAGE_NAME

# Verify deployment
log "Verifying deployment..."
HEALTH_CHECK=$(ssh $SERVER_USER@$SERVER_HOST "curl -s -o /dev/null -w '%{http_code}' http://localhost:3001" || echo "000")

if [ "$HEALTH_CHECK" = "200" ]; then
    success "Deployment successful! Application is responding on port 3001"
else
    warning "Application may not be responding correctly (HTTP: $HEALTH_CHECK)"
    log "Check logs with: ssh $SERVER_USER@$SERVER_HOST 'pm2 logs $SERVICE_NAME'"
fi

# Show PM2 status
log "PM2 Status:"
ssh $SERVER_USER@$SERVER_HOST "pm2 status"

success "Deployment completed!"
log "Application URL: https://admin.letsgo-speak.com"
log "To check logs: ssh $SERVER_USER@$SERVER_HOST 'pm2 logs $SERVICE_NAME'"
log "To monitor: ssh $SERVER_USER@$SERVER_HOST 'pm2 monit'"
log "To restart: ssh $SERVER_USER@$SERVER_HOST 'pm2 restart $SERVICE_NAME'"