#!/bin/bash
# Check Linera installation status

INSTALL_LOG="$HOME/linera-install.log"

echo "Checking Linera installation status..."
echo ""

if command -v linera &> /dev/null; then
    echo "✓ Linera is installed: $(linera --version)"
    exit 0
fi

if pgrep -f "cargo install.*linera-service" > /dev/null; then
    echo "⚙ Installation is running..."
    echo "  Check log: tail -f $INSTALL_LOG"
    exit 0
fi

echo "Linera not installed. Run: ./scripts/install-linera-robust.sh"
