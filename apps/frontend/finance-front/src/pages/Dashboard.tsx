import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  AccountBalance,
  Savings,
  PieChart,
  MonetizationOn,
  Diamond
} from '@mui/icons-material';
import { getFinanceRecords } from '../services/financeRecordService';
import PortfolioChart from '../components/PortfolioChart';
import AssetDonutChart from '../components/AssetDonutChart';

interface FinanceRecord {
  _id: string;
  date: string;
  secondPillar: number;
  secondPillarGain: number;
  thirdPillar: number;
  thirdPillarGain: number;
  etfPortfolio: number;
  etfGain: number;
  cash: number;
  gold: number;
}

interface PortfolioSummary {
  totalValue: number;
  totalGains: number;
  gainsPercentage: number;
  breakdown: {
    secondPillar: number;
    thirdPillar: number;
    etfPortfolio: number;
    cash: number;
    gold: number;
  };
}

const Dashboard: React.FC = () => {
  const [records, setRecords] = useState<FinanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null);

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const response = await getFinanceRecords();
      const sortedRecords = response.sort((a: FinanceRecord, b: FinanceRecord) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setRecords(sortedRecords);
      
      if (sortedRecords.length > 0) {
        calculatePortfolioSummary(sortedRecords);
      }
    } catch (err) {
      setError('Failed to fetch finance records');
      console.error('Error fetching records:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculatePortfolioSummary = (records: FinanceRecord[]) => {
    if (records.length === 0) return;

    const latest = records[0];
    const totalValue = latest.secondPillar + latest.thirdPillar + latest.etfPortfolio + latest.cash + latest.gold;
    const totalGains = latest.secondPillarGain + latest.thirdPillarGain + latest.etfGain;
    const totalInvested = totalValue - totalGains;
    const gainsPercentage = totalInvested > 0 ? (totalGains / totalInvested) * 100 : 0;

    setPortfolioSummary({
      totalValue,
      totalGains,
      gainsPercentage,
      breakdown: {
        secondPillar: latest.secondPillar,
        thirdPillar: latest.thirdPillar,
        etfPortfolio: latest.etfPortfolio,
        cash: latest.cash,
        gold: latest.gold,
      }
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('et-EE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getPercentageOfTotal = (value: number, total: number) => {
    return total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 4, fontWeight: 'bold' }}>
        Finance Dashboard
      </Typography>

      {portfolioSummary && (
        <>
          {/* Portfolio Overview Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={4}>
              <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <AccountBalance sx={{ mr: 2, fontSize: 32 }} />
                    <Typography variant="h6">Total Portfolio Value</Typography>
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    {formatCurrency(portfolioSummary.totalValue)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card sx={{ background: portfolioSummary.totalGains >= 0 ? 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' : 'linear-gradient(135deg, #fd746c 0%, #ff9068 100%)', color: 'white' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    {portfolioSummary.totalGains >= 0 ? <TrendingUp sx={{ mr: 2, fontSize: 32 }} /> : <TrendingDown sx={{ mr: 2, fontSize: 32 }} />}
                    <Typography variant="h6">Total Gains</Typography>
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    {formatCurrency(portfolioSummary.totalGains)}
                  </Typography>
                  <Chip 
                    label={`${portfolioSummary.gainsPercentage >= 0 ? '+' : ''}${portfolioSummary.gainsPercentage.toFixed(2)}%`}
                    sx={{ mt: 1, bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                  />
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <PieChart sx={{ mr: 2, fontSize: 32 }} />
                    <Typography variant="h6">Asset Classes</Typography>
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    5
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Different asset types
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Portfolio Breakdown */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                    <PieChart sx={{ mr: 1 }} />
                    Portfolio Breakdown
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    {[
                      { label: 'Second Pillar', value: portfolioSummary.breakdown.secondPillar, icon: <Savings />, color: '#667eea' },
                      { label: 'Third Pillar', value: portfolioSummary.breakdown.thirdPillar, icon: <AccountBalance />, color: '#764ba2' },
                      { label: 'ETF Portfolio', value: portfolioSummary.breakdown.etfPortfolio, icon: <TrendingUp />, color: '#11998e' },
                      { label: 'Cash', value: portfolioSummary.breakdown.cash, icon: <MonetizationOn />, color: '#38ef7d' },
                      { label: 'Gold', value: portfolioSummary.breakdown.gold, icon: <Diamond />, color: '#ffd700' },
                    ].map((item) => (
                      <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Box sx={{ color: item.color, mr: 2 }}>
                          {item.icon}
                        </Box>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                            {item.label}
                          </Typography>
                          <Typography variant="h6" sx={{ color: item.color, fontWeight: 'bold' }}>
                            {formatCurrency(item.value)}
                          </Typography>
                        </Box>
                        <Chip 
                          label={`${getPercentageOfTotal(item.value, portfolioSummary.totalValue)}%`}
                          size="small"
                          sx={{ bgcolor: item.color, color: 'white' }}
                        />
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <AssetDonutChart 
                data={portfolioSummary.breakdown} 
                totalValue={portfolioSummary.totalValue} 
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                    <TrendingUp sx={{ mr: 1 }} />
                    Performance Summary
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    {records.length > 0 && [
                      { label: 'Second Pillar Gain', value: records[0].secondPillarGain, color: '#667eea' },
                      { label: 'Third Pillar Gain', value: records[0].thirdPillarGain, color: '#764ba2' },
                      { label: 'ETF Gain', value: records[0].etfGain, color: '#11998e' },
                    ].map((item) => (
                      <Box key={item.label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                          {item.label}
                        </Typography>
                        <Typography 
                          variant="h6" 
                          sx={{ 
                            color: item.value >= 0 ? 'success.main' : 'error.main',
                            fontWeight: 'bold'
                          }}
                        >
                          {item.value >= 0 ? '+' : ''}{formatCurrency(item.value)}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </>
      )}

      {/* Portfolio Trends Chart */}
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <PortfolioChart records={records} />
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
