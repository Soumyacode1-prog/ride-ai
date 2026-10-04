import { Server } from "socket.io";
import { Server as HttpServer } from "http";

let io: Server;

export const initializeSocket = (
  httpServer: HttpServer
) => {
  io = new Server(httpServer, {
    cors: {
      origin: "http://localhost:3000",
      methods: ["GET", "POST", "PATCH"],
    },
  });

  io.on("connection", (socket) => {
    console.log(
      "Socket connected:",
      socket.id
    );

    // Customer/driver joins their own room.
    socket.on(
      "join:user",
      (userId: number) => {
        socket.join(`user:${userId}`);

        console.log(
          `User ${userId} joined socket room`
        );
      }
    );

    // Drivers join this room while using
    // the driver dashboard.
    socket.on("join:drivers", () => {
      socket.join("drivers");

      console.log(
        `Driver joined drivers room`
      );
    });

    socket.on("disconnect", () => {
      console.log(
        "Socket disconnected:",
        socket.id
      );
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error(
      "Socket.IO has not been initialized"
    );
  }

  return io;
};