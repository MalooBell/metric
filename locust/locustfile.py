from datetime import date, timedelta
import random, string
from locust import HttpUser, task, between, SequentialTaskSet
from prometheus_client import start_http_server, Counter, Gauge  # Import de Prometheus

# Démarre le serveur HTTP Prometheus pour exposer les métriques sur le port 9646
start_http_server(9646)

BASE_URL = "http://localhost:8000/api"
AGENT_ID = 1
MANAGER_ID = 2

# Définir des métriques Prometheus
REQUESTS = Counter('locust_requests_total', 'Nombre total de requêtes effectuées')
RESPONSE_TIME = Gauge('locust_response_time', 'Temps de réponse moyen des requêtes')

def rnd_str(n=6):
    return "".join(random.choices(string.ascii_uppercase, k=n))

# ---------- Séquence Agent ----------
class AgentFlow(SequentialTaskSet):
    wait_time = between(1, 3)

    def on_start(self):
        # Connexion session (cookie Laravel)
        self.client.post("/login", json={
            "email": "yoantioma4@gmail.com",
            "password": "Azebaze04@Azebaze04@"
        })

    @task
    def creer_objectif_complet(self):
        """
        POST /objectifs
        """
        payload = {
            "titre": f"Obj-{rnd_str()}",
            "description": "Objectif Locust auto",
            "metric": "Nb tickets résolus",
            "valeur": random.randint(10, 50),
            "poids": random.randint(5, 15),
            "date_debut": date.today().isoformat(),
            "date_fin": (date.today() + timedelta(days=90)).isoformat(),
            "statut_objectif": "en_attente",
            "manager_id": MANAGER_ID,
            "agent_id": AGENT_ID
        }

        with self.client.post("/objectifs", json=payload, name="/objectifs [POST]", catch_response=True) as resp:
            if resp.status_code == 201:
                self.objectif_id = resp.json().get("id")
                resp.success()
                REQUESTS.inc()  # Incrémente le compteur des requêtes
                RESPONSE_TIME.set(resp.elapsed.total_seconds())  # Enregistre le temps de réponse
            else:
                resp.failure(f"Création objectif KO ({resp.status_code})")

    @task
    def evaluer_objectif(self):
        """
        POST /evaluations
        """
        if not hasattr(self, "objectif_id"):
            return

        payload = {
            "objectif_id": self.objectif_id,
            "agent_id": AGENT_ID,
            "manager_id": MANAGER_ID,
            "comite_id": 1,
            "note_eval": random.randint(1, 5),
            "appreciation": "Évaluation Locust",
            "type_evaluation": "auto"
        }
        self.client.post("/evaluations", json=payload, name="/evaluations [POST]")
        REQUESTS.inc()  # Incrémente le compteur des requêtes

# ---------- Séquence Manager ----------
class ManagerFlow(SequentialTaskSet):
    wait_time = between(1, 3)

    def on_start(self):
        self.client.post("/login", json={
            "email": "jean.dupont@example.com",
            "password": "Min_ad@123"
        })

    @task(2)
    def lister_collaborateurs(self):
        self.client.get(f"/managers/{MANAGER_ID}/collaborateurs", name="/managers/{id}/collaborateurs")

    @task(1)
    def valider_objectifs_agent(self):
        self.client.post(f"/agents/{AGENT_ID}/objectifs/valider-tous", name="/agents/{id}/objectifs/valider-tous")

# ---------- Utilisateurs Locust ----------
class AgentUser(HttpUser):
    tasks = [AgentFlow]
    host = BASE_URL
    wait_time = between(1, 5)
    weight = 70  # 70 % du trafic

class ManagerUser(HttpUser):
    tasks = [ManagerFlow]
    host = BASE_URL
    wait_time = between(1, 5)
    weight = 30  # 30 % du trafic
