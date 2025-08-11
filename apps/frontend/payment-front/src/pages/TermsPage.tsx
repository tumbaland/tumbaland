import React from 'react';
import { Box, Typography, Stack, Divider } from '@mui/material';

const TermsPage: React.FC = () => {
  return (
    <Box sx={{ py: 5, px: 2, maxWidth: 900, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>Terms and Conditions</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Last updated: {new Date().toLocaleDateString()}
      </Typography>
      <Stack spacing={2}>
        <Typography variant="body1">
          These Terms and Conditions ("Terms") govern your use of Tumbaland and any related services. By subscribing or
          using the service, you agree to be bound by these Terms.
        </Typography>
        <Divider />
        <Typography variant="subtitle1">1. Subscriptions and Billing</Typography>
        <Typography variant="body2" color="text.secondary">
          Paid plans renew automatically unless canceled. You can cancel any time from your account. Taxes may apply.
        </Typography>
        <Typography variant="subtitle1">2. Refunds</Typography>
        <Typography variant="body2" color="text.secondary">
          Unless required by law, subscriptions are non-refundable. If you believe there is an error, contact support.
        </Typography>
        <Typography variant="subtitle1">3. Acceptable Use</Typography>
        <Typography variant="body2" color="text.secondary">
          Do not misuse the service. Follow applicable laws. We may suspend accounts that violate these Terms.
        </Typography>
        <Typography variant="subtitle1">4. Data and Privacy</Typography>
        <Typography variant="body2" color="text.secondary">
          We process your data as described in our Privacy Policy. You are responsible for content you upload.
        </Typography>
        <Typography variant="subtitle1">5. Changes</Typography>
        <Typography variant="body2" color="text.secondary">
          We may update these Terms. Continued use after changes means you accept the updated Terms.
        </Typography>
        <Typography variant="subtitle1">6. Contact</Typography>
        <Typography variant="body2" color="text.secondary">
          For questions, contact support.
        </Typography>
      </Stack>
    </Box>
  );
};

export default TermsPage;
