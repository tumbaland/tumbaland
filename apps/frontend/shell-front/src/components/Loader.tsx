import { Box, CircularProgress } from "@mui/material";

export function Loader() {
  return (
    <Box sx={{ display: "flex", alignItems: "center" }}>
      <CircularProgress size={24} color="inherit" />
    </Box>
  );
}
