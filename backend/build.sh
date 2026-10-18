#!/usr/bin/env bash
# Render build script for TMC Choir Evaluation System backend (Django + Daphne + Aiven MySQL)
set -o errexit

pip install --upgrade pip
pip install -r requirements.txt

python manage.py collectstatic --no-input
python manage.py migrate --no-input
