/** Commit your settings: hosted matches do not inherit your development environment. */
export const config = {
  mode: 'scripted' as 'scripted' | 'jev' | 'hybrid',
  style: 'adaptive' as 'adaptive' | 'collector' | 'raider',
  bankAt: 2,
  commitmentTicks: 40,
  jev: { intervalTicks: 10, maxCalls: 300, timeoutMs: 800, maxAgeTicks: 16, choiceTicks: 20 },
  planner: { intervalTicks: 200, maxCalls: 12, timeoutMs: 8000, maxAgeTicks: 160, planTicks: 200 },
  maxRequestBytes: 11000,
  maxTotalRequestBytes: 1800000,
  traceEveryTicks: 20,
};
export type Config = typeof config;
