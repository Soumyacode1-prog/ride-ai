declare namespace Express {
  export interface Request {
    user?: {
      userId: number;
      role: "CUSTOMER" | "DRIVER" | "ADMIN";
    };
  }
}