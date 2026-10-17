#!/bin/bash
# DEV ONLY: runs once when the MySQL volume is first created.
# Lets the app user create/drop the pytest-django test database (test_<MYSQL_DATABASE>).
set -euo pipefail

mysql --protocol=socket -uroot -p"${MYSQL_ROOT_PASSWORD}" <<SQL
GRANT ALL PRIVILEGES ON \`test_${MYSQL_DATABASE}\`.* TO '${MYSQL_USER}'@'%';
FLUSH PRIVILEGES;
SQL
