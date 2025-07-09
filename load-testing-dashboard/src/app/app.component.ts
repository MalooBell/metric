import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LoadTestService } from './services/load-test.service';
import { WebSocketService } from './services/websocket.service';
import { Subscription } from 'rxjs';

interface TestRun {
  id: number;
  name: string;
  target_url: string;
  users: number;
  spawn_rate: number;
  duration: number;
  start_time: string;
  end_time?: string;
  status: string;
  avg_response_time?: number;
  requests_per_second?: number;
  error_rate?: number;
  total_requests?: number;
}

interface TestStats {
  current_rps: number;
  avg_response_time: number;
  num_requests: number;
  num_failures: number;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  testForm: FormGroup;
  isTestRunning = false;
  currentTest: any = null;
  currentStats: TestStats | null = null;
  testHistory: TestRun[] = [];
  testProgress = 0;
  
  displayedColumns: string[] = [
    'name', 'start_time', 'users', 'avg_response_time', 
    'requests_per_second', 'error_rate', 'status', 'actions'
  ];

  private subscriptions: Subscription[] = [];

  constructor(
    private fb: FormBuilder,
    private loadTestService: LoadTestService,
    private wsService: WebSocketService,
    private snackBar: MatSnackBar
  ) {
    this.testForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      targetUrl: ['http://localhost:8000', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]],
      users: [10, [Validators.required, Validators.min(1), Validators.max(1000)]],
      spawnRate: [1, [Validators.required, Validators.min(0.1)]],
      duration: [300, [Validators.required, Validators.min(0)]]
    });
  }

  ngOnInit() {
    this.loadTestHistory();
    this.checkCurrentTest();
    this.setupWebSocketListeners();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.wsService.disconnect();
  }

  private setupWebSocketListeners() {
    this.wsService.connect();
    
    const wsSubscription = this.wsService.messages$.subscribe(message => {
      switch (message.type) {
        case 'test_started':
          this.isTestRunning = true;
          this.currentTest = { ...this.testForm.value, id: message.testId };
          this.showNotification('Test démarré avec succès', 'success');
          break;
          
        case 'test_stopped':
        case 'test_completed':
          this.isTestRunning = false;
          this.currentTest = null;
          this.currentStats = null;
          this.testProgress = 0;
          this.loadTestHistory();
          this.showNotification('Test terminé', 'info');
          break;
          
        case 'stats_update':
          if (message.stats && message.stats.stats) {
            const aggregated = message.stats.stats.find((s: any) => s.name === 'Aggregated');
            if (aggregated) {
              this.currentStats = aggregated;
              this.updateTestProgress();
            }
          }
          break;
      }
    });
    
    this.subscriptions.push(wsSubscription);
  }

  private updateTestProgress() {
    if (this.currentTest && this.currentTest.duration > 0) {
      const elapsed = (Date.now() - new Date(this.currentTest.start_time).getTime()) / 1000;
      this.testProgress = Math.min((elapsed / this.currentTest.duration) * 100, 100);
    }
  }

  async startTest() {
    if (this.testForm.valid && !this.isTestRunning) {
      try {
        const formValue = this.testForm.value;
        await this.loadTestService.startTest(formValue);
        // La notification sera gérée par le WebSocket
      } catch (error) {
        console.error('Erreur démarrage test:', error);
        this.showNotification('Erreur lors du démarrage du test', 'error');
      }
    }
  }

  async stopTest() {
    if (this.isTestRunning) {
      try {
        await this.loadTestService.stopTest();
        // La notification sera gérée par le WebSocket
      } catch (error) {
        console.error('Erreur arrêt test:', error);
        this.showNotification('Erreur lors de l\'arrêt du test', 'error');
      }
    }
  }

  private async checkCurrentTest() {
    try {
      const current = await this.loadTestService.getCurrentTest();
      if (current.running) {
        this.isTestRunning = true;
        this.currentTest = current;
        this.currentStats = current.stats;
      }
    } catch (error) {
      console.error('Erreur vérification test actuel:', error);
    }
  }

  private async loadTestHistory() {
    try {
      this.testHistory = await this.loadTestService.getTestHistory();
    } catch (error) {
      console.error('Erreur chargement historique:', error);
      this.showNotification('Erreur lors du chargement de l\'historique', 'error');
    }
  }

  getErrorRate(): number {
    if (!this.currentStats) return 0;
    const total = this.currentStats.num_requests;
    const failures = this.currentStats.num_failures;
    return total > 0 ? (failures / total) * 100 : 0;
  }

  getErrorColor(): string {
    const errorRate = this.getErrorRate();
    if (errorRate > 5) return 'warn';
    if (errorRate > 1) return 'accent';
    return 'primary';
  }

  getErrorRateClass(errorRate: number): string {
    if (!errorRate) return '';
    if (errorRate > 5) return 'error-high';
    if (errorRate > 1) return 'error-medium';
    return 'error-low';
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'completed': return 'primary';
      case 'running': return 'accent';
      case 'failed': return 'warn';
      case 'stopped': return '';
      default: return '';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'completed': return 'Terminé';
      case 'running': return 'En cours';
      case 'failed': return 'Échec';
      case 'stopped': return 'Arrêté';
      default: return status;
    }
  }

  openGrafana() {
    window.open('http://localhost:3000', '_blank');
  }

  openLocust() {
    window.open('http://localhost:8089', '_blank');
  }

  openPrometheus() {
    window.open('http://localhost:9090', '_blank');
  }

  viewInGrafana(test: TestRun) {
    if (test.start_time) {
      const startTime = new Date(test.start_time).getTime();
      const endTime = test.end_time ? new Date(test.end_time).getTime() : Date.now();
      
      const grafanaUrl = `http://localhost:3000/d/dashboard?from=${startTime}&to=${endTime}`;
      window.open(grafanaUrl, '_blank');
    }
  }

  private showNotification(message: string, type: 'success' | 'error' | 'info') {
    this.snackBar.open(message, 'Fermer', {
      duration: 5000,
      panelClass: [`snackbar-${type}`]
    });
  }
}