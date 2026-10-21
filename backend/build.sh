#!/usr/bin/env bash
# Render build script for TMC Choir Evaluation System backend (Django + Daphne + Aiven MySQL)
set -o errexit

pip install -r requirements/prod.txt

python manage.py collectstatic --no-input
# Migrations run as a release step, never while building an image.
