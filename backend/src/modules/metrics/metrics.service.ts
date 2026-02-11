import { Injectable } from '@nestjs/common';
import os from 'node:os';

@Injectable()
export class MetricsService {
  getMetrics() {
    const memory = process.memoryUsage();
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: process.uptime(),
      rssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
      heapTotalBytes: memory.heapTotal,
      externalBytes: memory.external,
      arrayBuffersBytes: memory.arrayBuffers,
      osLoadAverage: os.loadavg(),
      cpuCount: os.cpus().length,
      platform: process.platform,
      nodeVersion: process.version,
    };
  }
}
