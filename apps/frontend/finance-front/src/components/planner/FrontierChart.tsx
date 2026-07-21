import React, { useEffect, useRef, useState } from 'react';
import { Paper, useTheme } from '@mui/material';
import { FrontierSim, SimPoint } from '../../utils/frontierSim';

interface FrontierChartProps {
  sim: FrontierSim;
  targetPortfolio: SimPoint | null;
}

const MARGIN = { top: 30, right: 30, bottom: 55, left: 65 };
const CHART_HEIGHT = 480;

const FrontierChart: React.FC<FrontierChartProps> = ({ sim, targetPortfolio }) => {
  const theme = useTheme();
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(500);

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    // Floor of 200 (not 300) so this doesn't force the chart wider than a
    // narrow mobile container actually is — on phones the true offsetWidth
    // often dips below the old 300 floor, which forced the SVG to overflow
    // its (unclipped) container on every resize and slowly widen the page.
    const ro = new ResizeObserver(() => setChartWidth(Math.max(200, el.offsetWidth)));
    ro.observe(el);
    setChartWidth(Math.max(200, el.offsetWidth));
    return () => ro.disconnect();
  }, []);

  const innerW = chartWidth - MARGIN.left - MARGIN.right;
  const innerH = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;

  const vols = sim.points.map(p => p.vol);
  const rets = sim.points.map(p => p.ret);
  // tight padding so the data fills the plot area
  const volSpan = Math.max(...vols) - Math.min(...vols);
  const retSpan = Math.max(...rets) - Math.min(...rets);
  const minVol = Math.min(...vols) - volSpan * 0.05;
  const maxVol = Math.max(...vols) + volSpan * 0.05;
  const minRet = Math.min(...rets) - retSpan * 0.05;
  const maxRet = Math.max(...rets) + retSpan * 0.05;
  const toX = (v: number) => ((v - minVol) / (maxVol - minVol)) * innerW;
  const toY = (r: number) => innerH - ((r - minRet) / (maxRet - minRet)) * innerH;
  const sharpes = sim.points.map(p => p.sharpe);
  const minSharpe = Math.min(...sharpes);
  const maxSharpeVal = Math.max(...sharpes);
  const sharpeColor = (s: number) => {
    const t = Math.max(0, Math.min(1, (s - minSharpe) / (maxSharpeVal - minSharpe + 1e-9)));
    // blue → teal → green
    const r = Math.round(30 + (1 - t) * 100);
    const g = Math.round(100 + t * 120);
    const b = Math.round(200 - t * 100);
    return `rgb(${r},${g},${b})`;
  };
  const yTicks = Array.from({ length: 8 }, (_, i) => minRet + (i / 7) * (maxRet - minRet));
  const xTicks = Array.from({ length: 10 }, (_, i) => minVol + (i / 9) * (maxVol - minVol));

  const gridColor = theme.palette.divider;
  const tickColor = theme.palette.text.secondary;

  return (
    <Paper
      elevation={0}
      sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 0, overflow: 'hidden' }}
      ref={chartRef}
    >
      <svg width={chartWidth} height={CHART_HEIGHT} style={{ display: 'block', maxWidth: '100%' }}>
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {yTicks.map((r, i) => (
            <g key={i}>
              <line x1={0} y1={toY(r)} x2={innerW} y2={toY(r)} stroke={gridColor} />
              <text x={-8} y={toY(r) + 4} textAnchor="end" fontSize={11} fill={tickColor}>{r.toFixed(1)}%</text>
            </g>
          ))}
          {xTicks.map((v, i) => (
            <g key={i}>
              <line x1={toX(v)} y1={0} x2={toX(v)} y2={innerH} stroke={gridColor} />
              <text x={toX(v)} y={innerH + 16} textAnchor="middle" fontSize={11} fill={tickColor}>{v.toFixed(1)}%</text>
            </g>
          ))}
          <text x={innerW / 2} y={innerH + 38} textAnchor="middle" fontSize={12} fill={tickColor}>Annualised Volatility (%)</text>
          <text transform={`rotate(-90) translate(${-innerH / 2}, ${-40})`} textAnchor="middle" fontSize={12} fill={tickColor}>Annualised Return (%)</text>
          {sim.points.map((p, i) => (
            <circle key={i} cx={toX(p.vol)} cy={toY(p.ret)} r={2.5} fill={sharpeColor(p.sharpe)} opacity={0.55} />
          ))}
          <circle cx={toX(sim.minVol.vol)} cy={toY(sim.minVol.ret)} r={7} fill="#1976d2" stroke="#fff" strokeWidth={2} />
          <text x={toX(sim.minVol.vol) + 10} y={toY(sim.minVol.ret) + 4} fontSize={11} fill="#1976d2">Min Risk</text>
          {(() => {
            const cx = toX(sim.maxSharpe.vol), cy = toY(sim.maxSharpe.ret), r = 8;
            const pts = Array.from({ length: 5 }, (_, i) => {
              const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
              const ri = i % 2 === 0 ? r : r * 0.45;
              return `${cx + ri * Math.cos(a)},${cy + ri * Math.sin(a)}`;
            }).join(' ');
            return (<><polygon points={pts} fill="#f59e0b" stroke="#fff" strokeWidth={1.5} /><text x={cx + 12} y={cy + 4} fontSize={11} fill="#b45309">Max Sharpe</text></>);
          })()}
          {targetPortfolio && (() => {
            const cx = toX(targetPortfolio.vol), cy = toY(targetPortfolio.ret), s = 8;
            return (<><polygon points={`${cx},${cy - s} ${cx + s},${cy} ${cx},${cy + s} ${cx - s},${cy}`} fill="#7c3aed" stroke="#fff" strokeWidth={1.5} /><text x={cx + 11} y={cy + 4} fontSize={11} fill="#7c3aed">Target</text></>);
          })()}
          {sim.current && (<>
            <circle cx={toX(sim.current.vol)} cy={toY(sim.current.ret)} r={7} fill="#ef4444" stroke="#fff" strokeWidth={2} />
            <text x={toX(sim.current.vol) + 10} y={toY(sim.current.ret) + 4} fontSize={11} fill="#ef4444">You</text>
          </>)}
        </g>
      </svg>
    </Paper>
  );
};

export default FrontierChart;
