


import "dotenv/config";
import express from "express";
import pool from "./config/db";

import authRoutes from "./routes/auth.routes";
import { authenticate } from "./middleware/auth.middleware";
import { authorize } from "./middleware/role.middleware";
import driverRoutes from "./routes/driver.routes";
import rideRoutes from "./routes/ride.routes";
import paymentRoutes from "./routes/payment.routes";
import { connectRedis } from "./config/redis";
import cors from "cors";
import http from "http";
import { initializeSocket } from "./config/socket";


const app = express();

const PORT = 5001;
const httpServer = http.createServer(app);

initializeSocket(httpServer);

app.use(
  cors({
    origin: "http://localhost:3000",
  })
);

app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/rides", rideRoutes);
app.use(
  "/api/payments",
  paymentRoutes
);
app.get("/", (req, res) => {
  res.send("Ride AI backend is running 🚕");
});

app.get("/api/db-test", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT NOW() AS current_time"
    );

    res.status(200).json({
      success: true,
      message: "PostgreSQL connected successfully",
      databaseTime: result.rows[0].current_time,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

const startServer = async () => {
  try {
    await connectRedis();

    httpServer.listen(PORT, () => {
      console.log(
        `Server running on http://localhost:${PORT}`
      );
    });
  } catch (error) {
    console.error(
      "Failed to start server:",
      error
    );

    process.exit(1);
  }
};

startServer();

