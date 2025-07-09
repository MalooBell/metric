#!/usr/bin/env bash
set -e
mkdir -p ../grafana/json
for id in 20462 12081 1860 14574; do    # Locust + Node + GPU
  echo "Téléchargement dashboard $id"
  curl -sL "https://grafana.com/api/dashboards/${id}/revisions/1/download" \
       -o "../grafana/json/${id}.json"
done
echo "Dashboards importés."
