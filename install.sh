#!/usr/bin/env bash
# openissue installer script
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Installing openissue...${NC}"

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    echo -e "${RED}Error: Bun is not installed.${NC}"
    echo "Please install Bun first:"
    echo "  curl -fsSL https://bun.sh/install | bash"
    exit 1
fi

# Check if gh or glab is installed
if ! command -v gh &> /dev/null && ! command -v glab &> /dev/null; then
    echo -e "${YELLOW}Warning: Neither 'gh' nor 'glab' CLI is installed.${NC}"
    echo "openissue requires one of these to interact with GitHub/GitLab:"
    echo "  GitHub CLI: https://cli.github.com/"
    echo "  GitLab CLI: https://gitlab.com/gitlab-org/cli"
    echo ""
    echo -e "${YELLOW}Installation will continue, but you'll need to install one before using openissue.${NC}"
    echo ""
fi

# Install openissue globally
echo "Installing from GitHub..."
bun install -g github:ofrades/openissue

# Verify installation
if command -v openissue &> /dev/null; then
    echo -e "${GREEN}✓ openissue installed successfully!${NC}"
    echo ""
    echo "Usage:"
    echo "  cd your-project"
    echo "  openissue"
    echo ""
    echo "Keyboard shortcuts:"
    echo "  n: new issue"
    echo "  j/k or ↑/↓: navigate"
    echo "  space: view issue"
    echo "  x: close/reopen"
    echo "  q: quit"
else
    echo -e "${RED}Error: Installation completed but 'openissue' command not found.${NC}"
    echo "You may need to add Bun's global bin directory to your PATH:"
    echo "  export PATH=\"\$HOME/.bun/bin:\$PATH\""
    exit 1
fi
