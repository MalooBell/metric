const express = require('express');
const cors = require('cors');
const { exec, spawn } = require('child_process');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const WebSocket = require('ws');
const path = require('path');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Base de données SQLite pour l'historique
const db = new sqlite3.Database('./test_history.db');

// Initialisation de la base de données
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS test_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    target_url TEXT,
    users INTEGER,
    spawn_rate REAL,
    duration INTEGER,
    start_time DATETIME,
    end_time DATETIME,
    status TEXT,
    avg_response_time REAL,
    requests_per_second REAL,
    error_rate REAL,
    total_requests INTEGER
  )`);
});

// WebSocket pour les mises à jour en temps réel
const wss = new WebSocket.Server({ port: 8080 });

let currentTestProcess = null;
let currentTestId = null;

// Fonction pour broadcaster aux clients WebSocket
function broadcast(data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// Routes API

// Démarrer un test
app.post('/api/tests/start', async (req, res) => {
  const { name, targetUrl, users, spawnRate, duration } = req.body;

  if (currentTestProcess) {
    return res.status(400).json({ error: 'Un test est déjà en cours' });
  }

  try {
    // Insérer le test dans la base de données
    const stmt = db.prepare(`INSERT INTO test_runs 
      (name, target_url, users, spawn_rate, duration, start_time, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`);
    
    const startTime = new Date().toISOString();
    stmt.run([name, targetUrl, users, spawnRate, duration, startTime, 'running'], function(err) {
      if (err) {
        console.error('Erreur DB:', err);
        return res.status(500).json({ error: 'Erreur base de données' });
      }
      
      currentTestId = this.lastID;
      
      // Modifier le fichier locustfile.py pour utiliser la bonne URL
      const locustCommand = `cd ${path.join(__dirname, '..')} && docker-compose up -d`;
      
      currentTestProcess = exec(locustCommand, (error, stdout, stderr) => {
        if (error) {
          console.error('Erreur Docker:', error);
          updateTestStatus(currentTestId, 'failed');
          currentTestProcess = null;
          currentTestId = null;
          return;
        }
        
        console.log('Docker Compose démarré:', stdout);
        
        // Attendre que Locust soit prêt puis démarrer le test
        setTimeout(() => {
          startLocustTest(targetUrl, users, spawnRate, duration);
        }, 10000);
      });

      broadcast({ type: 'test_started', testId: currentTestId, name });
      res.json({ success: true, testId: currentTestId });
    });
    
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ error: 'Erreur lors du démarrage du test' });
  }
});

// Arrêter un test
app.post('/api/tests/stop', (req, res) => {
  if (!currentTestProcess) {
    return res.status(400).json({ error: 'Aucun test en cours' });
  }

  // Arrêter Docker Compose
  exec(`cd ${path.join(__dirname, '..')} && docker-compose down`, (error, stdout, stderr) => {
    if (error) {
      console.error('Erreur arrêt Docker:', error);
    }
    
    if (currentTestId) {
      updateTestStatus(currentTestId, 'stopped');
      broadcast({ type: 'test_stopped', testId: currentTestId });
    }
    
    currentTestProcess = null;
    currentTestId = null;
    
    res.json({ success: true });
  });
});

// Obtenir le statut du test actuel
app.get('/api/tests/current', async (req, res) => {
  if (!currentTestId) {
    return res.json({ running: false });
  }

  try {
    // Récupérer les métriques en temps réel depuis Locust
    const locustStats = await getLocustStats();
    const prometheusMetrics = await getPrometheusMetrics();
    
    res.json({
      running: true,
      testId: currentTestId,
      stats: locustStats,
      systemMetrics: prometheusMetrics
    });
  } catch (error) {
    console.error('Erreur récupération stats:', error);
    res.json({ running: true, testId: currentTestId, error: 'Impossible de récupérer les stats' });
  }
});

// Obtenir l'historique des tests
app.get('/api/tests/history', (req, res) => {
  db.all(`SELECT * FROM test_runs ORDER BY start_time DESC LIMIT 50`, (err, rows) => {
    if (err) {
      console.error('Erreur DB:', err);
      return res.status(500).json({ error: 'Erreur base de données' });
    }
    res.json(rows);
  });
});

// Obtenir les détails d'un test spécifique
app.get('/api/tests/:id', (req, res) => {
  const testId = req.params.id;
  db.get(`SELECT * FROM test_runs WHERE id = ?`, [testId], (err, row) => {
    if (err) {
      console.error('Erreur DB:', err);
      return res.status(500).json({ error: 'Erreur base de données' });
    }
    res.json(row);
  });
});

// Fonctions utilitaires

async function startLocustTest(targetUrl, users, spawnRate, duration) {
  try {
    // Démarrer le test via l'API Locust
    await axios.post('http://localhost:8089/swarm', {
      user_count: users,
      spawn_rate: spawnRate,
      host: targetUrl
    });

    // Programmer l'arrêt du test après la durée spécifiée
    if (duration > 0) {
      setTimeout(async () => {
        try {
          await axios.get('http://localhost:8089/stop');
          if (currentTestId) {
            await finalizeTest(currentTestId);
          }
        } catch (error) {
          console.error('Erreur arrêt automatique:', error);
        }
      }, duration * 1000);
    }
  } catch (error) {
    console.error('Erreur démarrage test Locust:', error);
    if (currentTestId) {
      updateTestStatus(currentTestId, 'failed');
    }
  }
}

async function getLocustStats() {
  try {
    const response = await axios.get('http://localhost:8089/stats/requests');
    return response.data;
  } catch (error) {
    console.error('Erreur récupération stats Locust:', error);
    return null;
  }
}

async function getPrometheusMetrics() {
  try {
    const response = await axios.get('http://localhost:9090/api/v1/query?query=up');
    return response.data;
  } catch (error) {
    console.error('Erreur récupération métriques Prometheus:', error);
    return null;
  }
}

function updateTestStatus(testId, status) {
  const endTime = new Date().toISOString();
  db.run(`UPDATE test_runs SET status = ?, end_time = ? WHERE id = ?`, 
    [status, endTime, testId], (err) => {
      if (err) {
        console.error('Erreur mise à jour statut:', err);
      }
    });
}

async function finalizeTest(testId) {
  try {
    const stats = await getLocustStats();
    if (stats && stats.stats) {
      const totalStats = stats.stats.find(s => s.name === 'Aggregated');
      if (totalStats) {
        db.run(`UPDATE test_runs SET 
          avg_response_time = ?,
          requests_per_second = ?,
          error_rate = ?,
          total_requests = ?,
          status = 'completed'
          WHERE id = ?`, 
          [
            totalStats.avg_response_time,
            totalStats.current_rps,
            (totalStats.num_failures / totalStats.num_requests) * 100,
            totalStats.num_requests,
            testId
          ]);
      }
    }
    
    broadcast({ type: 'test_completed', testId });
    currentTestProcess = null;
    currentTestId = null;
  } catch (error) {
    console.error('Erreur finalisation test:', error);
    updateTestStatus(testId, 'failed');
  }
}

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`Serveur backend démarré sur le port ${PORT}`);
});

// Gestion des connexions WebSocket
wss.on('connection', (ws) => {
  console.log('Nouvelle connexion WebSocket');
  
  ws.on('close', () => {
    console.log('Connexion WebSocket fermée');
  });
});

// Monitoring en temps réel
setInterval(async () => {
  if (currentTestId) {
    try {
      const stats = await getLocustStats();
      if (stats) {
        broadcast({ 
          type: 'stats_update', 
          testId: currentTestId, 
          stats 
        });
      }
    } catch (error) {
      console.error('Erreur monitoring:', error);
    }
  }
}, 5000); // Mise à jour toutes les 5 secondes