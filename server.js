const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "5mb" }));

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (req, res) => {
    res.json({
        ok: true,
        name: "Nitron GPS",
        version: "3.0.0",
        time: new Date().toISOString()
    });
});

app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
    console.log("");
    console.log("======================================");
    console.log("       NITRON GPS V3.0.0");
    console.log("======================================");
    console.log(`Local:   http://localhost:${PORT}`);
    console.log(`Network: http://YOUR-PC-IP:${PORT}`);
    console.log("======================================");
});