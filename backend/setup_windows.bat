@echo off
REM ============================================================
REM  MIRA – Windows Setup Script (Python 3.14 compatible)
REM  Double-click OR run: cd backend && setup_windows.bat
REM ============================================================

echo.
echo  ==============================================
echo   MIRA – Backend Setup (Windows / Python 3.14)
echo  ==============================================
echo.

REM Check Python version
python --version
if errorlevel 1 (
    echo  ERROR: Python not found. Install from https://python.org
    pause & exit /b 1
)

REM Step 1: Upgrade pip to latest (CRITICAL — old pip picks wrong wheels)
echo  [1/5] Upgrading pip to latest version...
python -m pip install --upgrade pip
if errorlevel 1 ( echo  ERROR: pip upgrade failed & pause & exit /b 1 )

REM Step 2: Create virtual environment
echo.
echo  [2/5] Creating virtual environment...
if exist venv (
    echo  venv already exists, skipping.
) else (
    python -m venv venv
    if errorlevel 1 ( echo  ERROR: venv creation failed & pause & exit /b 1 )
)

REM Step 3: Activate venv
call venv\Scripts\activate

REM Step 4: Install all packages
REM  scikit-learn >= 1.8 and numpy >= 2.0 have pre-built wheels for Python 3.14
REM  Using --only-binary :all: forces wheel install — no C compiler needed
echo.
echo  [3/5] Installing Python packages (pre-built wheels only)...
pip install --upgrade pip
pip install --only-binary :all: "numpy>=2.0.0"
pip install --only-binary :all: "scikit-learn>=1.8.0"
pip install --only-binary :all: "pandas>=2.2.0"
pip install "joblib>=1.4.0"
pip install flask==3.0.3 flask-sqlalchemy==3.1.1 flask-cors==4.0.1

if errorlevel 1 (
    echo.
    echo  ERROR: Package installation failed.
    echo  Try:  pip install -r requirements.txt --only-binary :all:
    pause & exit /b 1
)

echo.
echo  [5/5] Verifying installation...
python -c "import sklearn, numpy, pandas, flask; print('  sklearn:', sklearn.__version__); print('  numpy  :', numpy.__version__); print('  pandas :', pandas.__version__); print('  flask  :', flask.__version__)"

echo.
echo  ==============================================
echo   Setup complete!
echo.
echo   START BACKEND:
echo     venv\Scripts\activate
echo     python train_model.py   
echo     python app.py
echo     ^(runs at http://localhost:5000^)
echo.
echo   START FRONTEND ^(new terminal^):
echo     cd ..\frontend
echo     npm install
echo     npm start
echo     ^(opens http://localhost:3000^)
echo  ==============================================
echo.
pause
