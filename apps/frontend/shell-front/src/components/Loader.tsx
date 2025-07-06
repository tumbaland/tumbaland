import { Box, CircularProgress } from "@mui/material";

export function Loader() {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
      }}
    >
      <CircularProgress size={40} />
    </Box>
  );
}
