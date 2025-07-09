# Load Testing Dashboard

Interface Angular pour piloter et monitorer vos tests de charge avec Locust, Prometheus et Grafana.

## Architecture

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│  Angular App    │───▶│  Node.js API │───▶│  Docker Compose │
│  (Frontend)     │    │  (Backend)   │    │  (Locust, etc.) │
└─────────────────┘    └──────────────┘    └─────────────────┘
         │                       │                    │
         │                       ▼                    ▼
         │              ┌──────────────┐    ┌─────────────────┐
         │              │   SQLite     │    │   Prometheus    │
         │              │ (Historique) │    │   (Métriques)   │
         │              └──────────────┘    └─────────────────┘
         │                                           │
         └───────────────────────────────────────────▼
                                           ┌─────────────────┐
                                           │     Grafana     │
                                           │  (Dashboards)   │
                                           └─────────────────┘
```

## Fonctionnalités

### 🚀 Panneau de Configuration
- **Formulaire intuitif** pour configurer les tests
- **Validation en temps réel** des paramètres
- **Démarrage/Arrêt** des tests en un clic
- **Statut en temps réel** avec métriques live

### 📊 Monitoring Intégré
- **Dashboards Grafana** intégrés dans l'interface
- **Métriques Prometheus** en temps réel
- **Interface Locust** accessible directement
- **WebSocket** pour les mises à jour live

### 📈 Historique et Analyse
- **Base de données SQLite** pour l'historique
- **Comparaison** entre différents tests
- **Export** vers Grafana avec filtrage temporel
- **Métriques clés** : temps de réponse, RPS, taux d'erreur

## Installation et Démarrage

### 1. Prérequis
```bash
# Docker et Docker Compose installés
docker --version
docker-compose --version

# Node.js 16+ installé
node --version
npm --version
```

### 2. Installation
```bash
# Cloner le projet
git clone <votre-repo>
cd load-testing-dashboard

# Installer les dépendances backend
npm install

# Installer les dépendances frontend
cd load-testing-dashboard
npm install
cd ..
```

### 3. Démarrage

#### Option A: Développement (3 terminaux)
```bash
# Terminal 1: Backend API
npm run dev

# Terminal 2: Frontend Angular
npm run serve-frontend

# Terminal 3: Infrastructure (si nécessaire)
docker-compose up -d
```

#### Option B: Production
```bash
# Build du frontend
npm run build-frontend

# Démarrage du backend (sert aussi le frontend)
npm start
```

### 4. Accès aux interfaces

- **Dashboard Principal**: http://localhost:4200
- **API Backend**: http://localhost:3001
- **Locust UI**: http://localhost:8089
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (admin/admin)

## Utilisation

### Démarrer un Test
1. Ouvrir l'onglet **"Nouveau Test"**
2. Remplir le formulaire :
   - **Nom du test** : Identifiant unique
   - **URL cible** : Application à tester
   - **Nombre d'utilisateurs** : Charge simulée
   - **Vitesse d'apparition** : Montée en charge
   - **Durée** : 0 = illimité
3. Cliquer sur **"Démarrer le Test"**

### Suivre un Test
- **Métriques temps réel** dans l'onglet "Nouveau Test"
- **Dashboards Grafana** dans l'onglet "Monitoring"
- **Interface Locust** via le menu (bouton ⋮)

### Analyser l'Historique
1. Onglet **"Historique"**
2. Consulter les **résultats passés**
3. Cliquer sur 📊 pour **ouvrir dans Grafana**
4. **Comparer** les performances entre tests

## Configuration Avancée

### Personnaliser les Scénarios Locust
Modifier `locust/locustfile.py` pour adapter les scénarios à votre application.

### Ajouter des Dashboards Grafana
```bash
# Télécharger des dashboards supplémentaires
cd scripts
./fetch_dashboards.sh
```

### Configuration Prometheus
Modifier `prometheus/prometheus.yml` pour ajouter de nouvelles sources de métriques.

## Dépannage

### Le test ne démarre pas
1. Vérifier que Docker est démarré
2. Vérifier les ports disponibles (8089, 9090, 3000)
3. Consulter les logs : `docker-compose logs`

### Pas de métriques dans Grafana
1. Vérifier la connexion Prometheus : http://localhost:9090/targets
2. Vérifier la configuration datasource dans Grafana
3. Redémarrer les services : `docker-compose restart`

### Interface non accessible
1. Vérifier que le backend est démarré : `npm run dev`
2. Vérifier que le frontend est compilé : `npm run build-frontend`
3. Vérifier les ports 3001 et 4200

## Développement

### Structure du Projet
```
├── server/                 # Backend Node.js
│   └── index.js           # API principale
├── load-testing-dashboard/ # Frontend Angular
│   ├── src/app/           # Composants Angular
│   └── src/services/      # Services (API, WebSocket)
├── locust/                # Configuration Locust
├── prometheus/            # Configuration Prometheus
├── grafana/               # Configuration Grafana
└── scripts/               # Scripts utilitaires
```

### Ajouter des Fonctionnalités
1. **Backend** : Ajouter des routes dans `server/index.js`
2. **Frontend** : Créer des composants dans `load-testing-dashboard/src/app/`
3. **Base de données** : Modifier le schéma SQLite dans `server/index.js`

## Contribution

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/nouvelle-fonctionnalite`)
3. Commit les changes (`git commit -am 'Ajout nouvelle fonctionnalité'`)
4. Push la branche (`git push origin feature/nouvelle-fonctionnalite`)
5. Créer une Pull Request

## Licence

MIT License - voir le fichier LICENSE pour plus de détails.