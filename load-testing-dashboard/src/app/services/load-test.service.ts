import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface TestConfig {
  name: string;
  targetUrl: string;
  users: number;
  spawnRate: number;
  duration: number;
}

export interface TestRun {
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

@Injectable({
  providedIn: 'root'
})
export class LoadTestService {
  private readonly API_BASE = 'http://localhost:3001/api';

  constructor(private http: HttpClient) {}

  async startTest(config: TestConfig): Promise<any> {
    return firstValueFrom(
      this.http.post(`${this.API_BASE}/tests/start`, config)
    );
  }

  async stopTest(): Promise<any> {
    return firstValueFrom(
      this.http.post(`${this.API_BASE}/tests/stop`, {})
    );
  }

  async getCurrentTest(): Promise<any> {
    return firstValueFrom(
      this.http.get(`${this.API_BASE}/tests/current`)
    );
  }

  async getTestHistory(): Promise<TestRun[]> {
    return firstValueFrom(
      this.http.get<TestRun[]>(`${this.API_BASE}/tests/history`)
    );
  }

  async getTestDetails(testId: number): Promise<TestRun> {
    return firstValueFrom(
      this.http.get<TestRun>(`${this.API_BASE}/tests/${testId}`)
    );
  }
}