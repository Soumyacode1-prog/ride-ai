"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/auth/login`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.message || "Login failed");
      return;
    }

    // Save JWT
    localStorage.setItem("token", data.token);

    // Save logged-in user
    localStorage.setItem(
      "user",
      JSON.stringify(data.user)
    );

    // ============================
    // DRIVER LOGIN
    // ============================

    if (data.user.role === "DRIVER") {
      try {
        const profileResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/drivers/me`,
          {
            headers: {
              Authorization: `Bearer ${data.token}`,
            },
          }
        );

        // Driver already completed setup
        if (profileResponse.ok) {
          router.push("/driver");
          return;
        }

        // Driver has not completed setup
        if (profileResponse.status === 404) {
          router.push("/driver/setup");
          return;
        }

        setMessage("Unable to check driver profile");
        return;
      } catch {
        setMessage("Unable to connect to server");
        return;
      }
    }

    // ============================
    // CUSTOMER LOGIN
    // ============================

    if (data.user.role === "CUSTOMER") {
      router.push("/customer");
      return;
    }
  } catch {
    setMessage("Unable to connect to server");
  }
};

  return (
    <main className="flex min-h-screen items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-4 p-6"
      >
        <h1 className="text-3xl font-bold">
          Login to RideAI
        </h1>

        <input
          type="email"
          placeholder="Email"
          className="w-full border p-3"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full border p-3"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          type="submit"
          className="w-full bg-black p-3 text-white"
        >
          Login
        </button>
        
        {message && (
          <p className="text-red-500">{message}</p>
        )}
      </form>
    </main>
  );
}