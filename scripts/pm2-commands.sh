#!/bin/bash
# scripts/pm2-commands.sh - PM2 Management Commands

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Crypto Membership NFT - PM2 Management${NC}"
echo "=================================================="

# Function to check if PM2 is installed
check_pm2() {
    if ! command -v pm2 &> /dev/null; then
        echo -e "${RED}❌ PM2 is not installed. Installing PM2...${NC}"
        npm install -g pm2
        echo -e "${GREEN}✅ PM2 installed successfully${NC}"
    else
        echo -e "${GREEN}✅ PM2 is already installed${NC}"
    fi
}

# Function to create logs directory
setup_logs() {
    echo -e "${YELLOW}📁 Creating logs directory...${NC}"
    mkdir -p logs
    touch logs/app.log logs/out.log logs/error.log logs/events.log logs/events-out.log logs/events-error.log
    echo -e "${GREEN}✅ Logs directory created${NC}"
}

# Function to setup environment
setup_env() {
    echo -e "${YELLOW}🔧 Setting up environment...${NC}"
    
    # Check if .env exists
    if [ ! -f .env ]; then
        echo -e "${RED}❌ .env file not found!${NC}"
        echo "Please create .env file with required variables"
        exit 1
    fi
    
    # Install dependencies
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
    
    # Setup bot commands
    echo -e "${YELLOW}🤖 Setting up Telegram bot...${NC}"
    npm run setup-bot
    
    echo -e "${GREEN}✅ Environment setup complete${NC}"
}

# Function to start the application
start_app() {
    echo -e "${YELLOW}🚀 Starting Crypto Membership NFT...${NC}"
    
    # Start with PM2 using ecosystem file
    pm2 start ecosystem.config.js --env production
    
    # Save PM2 configuration
    pm2 save
    
    # Setup PM2 startup script
    pm2 startup
    
    echo -e "${GREEN}✅ Application started successfully${NC}"
    echo -e "${BLUE}📊 Check status with: pm2 status${NC}"
}

# Function to stop the application
stop_app() {
    echo -e "${YELLOW}🛑 Stopping application...${NC}"
    pm2 stop crypto-membership-nft
    pm2 stop event-listener
    echo -e "${GREEN}✅ Application stopped${NC}"
}

# Function to restart the application
restart_app() {
    echo -e "${YELLOW}🔄 Restarting application...${NC}"
    pm2 restart crypto-membership-nft
    pm2 restart event-listener
    echo -e "${GREEN}✅ Application restarted${NC}"
}

# Function to reload the application (zero downtime)
reload_app() {
    echo -e "${YELLOW}🔄 Reloading application...${NC}"
    pm2 reload ecosystem.config.js --env production
    echo -e "${GREEN}✅ Application reloaded${NC}"
}

# Function to show status
show_status() {
    echo -e "${BLUE}📊 Application Status:${NC}"
    pm2 status
    echo ""
    pm2 monit
}

# Function to show logs
show_logs() {
    echo -e "${BLUE}📝 Recent Logs:${NC}"
    pm2 logs crypto-membership-nft --lines 50
}

# Function to monitor the application
monitor_app() {
    echo -e "${BLUE}📊 Monitoring application...${NC}"
    pm2 monit
}

# Function to delete all PM2 processes
delete_app() {
    echo -e "${RED}🗑️  Deleting all PM2 processes...${NC}"
    pm2 delete crypto-membership-nft
    pm2 delete event-listener
    pm2 save
    echo -e "${GREEN}✅ All processes deleted${NC}"
}

# Function to show help
show_help() {
    echo -e "${BLUE}📖 Available Commands:${NC}"
    echo "  setup     - Install PM2, create logs, setup environment"
    echo "  start     - Start the application"
    echo "  stop      - Stop the application"
    echo "  restart   - Restart the application"
    echo "  reload    - Reload application (zero downtime)"
    echo "  status    - Show application status"
    echo "  logs      - Show recent logs"
    echo "  monitor   - Open PM2 monitoring dashboard"
    echo "  delete    - Delete all PM2 processes"
    echo "  health    - Check application health"
    echo ""
    echo -e "${YELLOW}Quick Start:${NC}"
    echo "  ./scripts/pm2-commands.sh setup"
    echo "  ./scripts/pm2-commands.sh start"
}

# Function to check application health
check_health() {
    echo -e "${BLUE}🏥 Checking application health...${NC}"
    
    # Check if processes are running
    if pm2 list | grep -q "crypto-membership-nft.*online"; then
        echo -e "${GREEN}✅ Main application is running${NC}"
    else
        echo -e "${RED}❌ Main application is not running${NC}"
    fi
    
    # Check HTTP endpoint
    if curl -s http://localhost:3000/health > /dev/null; then
        echo -e "${GREEN}✅ HTTP endpoint is responding${NC}"
    else
        echo -e "${RED}❌ HTTP endpoint is not responding${NC}"
    fi
    
    # Check logs for errors
    error_count=$(pm2 logs crypto-membership-nft --lines 100 --nostream | grep -i error | wc -l)
    if [ "$error_count" -gt 0 ]; then
        echo -e "${YELLOW}⚠️  Found $error_count recent errors in logs${NC}"
    else
        echo -e "${GREEN}✅ No recent errors in logs${NC}"
    fi
}

# Main script logic
case "$1" in
    setup)
        check_pm2
        setup_logs
        setup_env
        ;;
    start)
        start_app
        ;;
    stop)
        stop_app
        ;;
    restart)
        restart_app
        ;;
    reload)
        reload_app
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    monitor)
        monitor_app
        ;;
    delete)
        delete_app
        ;;
    health)
        check_health
        ;;
    *)
        show_help
        ;;
esac