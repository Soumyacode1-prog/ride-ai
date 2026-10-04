import {
  NextFunction,
  Request,
  Response,
} from "express";

import redisClient from "../config/redis";

export const rideRateLimit = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const key =
      `rate_limit:ride:${userId}`;

    const requests =
      await redisClient.incr(key);

    /*
     * First request:
     * start a 60-second window.
     */
    if (requests === 1) {
      await redisClient.expire(
        key,
        60
      );
    }

    /*
     * Maximum 5 ride requests
     * every 60 seconds.
     */
    if (requests > 5) {
      const ttl =
        await redisClient.ttl(key);

      return res.status(429).json({
        success: false,
        message:
          "Too many ride requests. Please try again later.",
        retryAfter: ttl,
      });
    }

    next();
  } catch (error) {
    console.error(
      "Rate limit error:",
      error
    );

    /*
     * Redis failure should not necessarily
     * bring down the whole API.
     */
    next();
  }
};