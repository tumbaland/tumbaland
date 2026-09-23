/**
 * The dashboard's statistics, one module per question: totals per type
 * (summary), what has gone quiet (streaks), what is worth aiming at
 * (milestones), which way things are moving (trends), and the charts
 * (monthly, heatmap, timeline).
 */
export type { StatisticsFilters } from './shared';
export * from './summary';
export * from './streaks';
export * from './monthly';
export * from './heatmap';
export * from './timeline';
export * from './milestones';
export * from './trends';
