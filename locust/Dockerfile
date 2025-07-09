# Image Python de base
FROM python:3.11-slim

# Copie le requirements et installe toutes les dépendances en UNE couche
COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# Répertoire de travail par défaut
WORKDIR /mnt/locust

# CMD par défaut : lance Locust et cherche le locustfile dans /mnt/locust
CMD ["locust", "-f", "locustfile.py"]
