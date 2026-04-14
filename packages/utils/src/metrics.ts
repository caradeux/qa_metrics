export interface KPIs {
  totalDesigned: number;
  totalExecuted: number;
  totalDefects: number;
  executionRatio: number;
}

export interface WeeklyTrendPoint {
  weekStart: string;
  designed: number;
  executed: number;
  defects: number;
}

export interface CaseTypeDistribution {
  functional: { designed: number; executed: number };
  regression: { designed: number; executed: number };
  smoke: { designed: number; executed: number };
  exploratory: { designed: number; executed: number };
}

export interface DefectDistribution {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface TesterSummary {
  testerId: string;
  testerName: string;
  designed: number;
  executed: number;
  defects: number;
  ratio: number;
}
