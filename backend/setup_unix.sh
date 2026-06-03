#!/bin/bash
# ============================================================
#  MIRA – macOS / Linux Setup Script
#  Usage: cd backend && bash setup_unix.sh
# ============================================================

set -e

echo ""
echo " =============================================="
echo "  MIRA – Backend Setup (macOS / Linux)"
echo " =============================================="
echo ""

# Step 1: Upgrade pip
echo " [1/4] Upgrading pip, setuptools, wheel..."
python3 -m pip install --upgrade pip setuptools wheel

# Step 2: Create virtual environment
echo ""
echo " [2/4] Creating virtual environment (venv)..."
if [ -d "venv" ]; then
    echo " venv already exists, skipping creation."
else
    python3 -m venv venv
fi

# Step 3: Activate and install
echo ""
echo " [3/4] Installing packages..."
source venv/bin/activate

pip install --upgrade pip setuptools wheel
pip install -r requirements.txt

# Step 4: Train model
echo ""
echo " [4/4] Training the local ML model (model.pkl)..."
python train_model.py

echo ""
echo " =============================================="
echo "  Setup complete!"
echo ""
echo "  To start the backend:"
echo "    source venv/bin/activate"
echo "    python app.py"
echo ""
echo "  Then start the frontend (new terminal):"
echo "    cd ../frontend"
echo "    npm install && npm start"
echo " =============================================="
echo ""
