import { Box } from "@mui/material";

export default function BgImageBox() {
  return (
    <Box
      component="img"
      src="/background.png"
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        objectFit: "cover",
        zIndex: 0,
        opacity: 0.55,
        pointerEvents: "none",
        userSelect: "none",
      }}
    />
  );
}
