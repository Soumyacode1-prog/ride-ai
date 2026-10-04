"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { socket } from "../../lib/socket";

// ============================================
// TYPES
// ============================================

interface Ride {
  id: number;
  pickup_address: string;
  drop_address: string;
  estimated_fare: string;
  final_fare: string | null;

  status:
    | "SEARCHING"
    | "DRIVER_ASSIGNED"
    | "DRIVER_ARRIVED"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "CANCELLED";

  driver_name: string | null;
  vehicle_number: string | null;
  vehicle_type: string | null;
  brand: string | null;
  model: string | null;

  requested_at: string;
}

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface Payment {
  id: number;
  ride_id: number;
  amount: string;

  status:
    | "PENDING"
    | "SUCCESS"
    | "FAILED";
}

// ============================================
// CUSTOMER PAGE
// ============================================

export default function CustomerPage() {
  const router = useRouter();

  // ============================================
  // STATE
  // ============================================

  const [user, setUser] =
    useState<User | null>(null);

  const [pickupAddress, setPickupAddress] =
    useState("");

  const [dropAddress, setDropAddress] =
    useState("");

  const [rides, setRides] =
    useState<Ride[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [booking, setBooking] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [payments, setPayments] =
    useState<Record<number, Payment | null>>({});

  // ============================================
  // GET CUSTOMER RIDES
  // IMPORTANT: declared before socket effects
  // ============================================

  const loadRides = useCallback(async () => {
    try {
      const data = await apiFetch(
        "/rides/my"
      );

      setRides(data.rides);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load rides"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================
  // LOAD PAYMENT FOR A RIDE
  // ============================================

  const loadPayment = useCallback(
    async (rideId: number) => {
      try {
        const data = await apiFetch(
          `/payments/ride/${rideId}`
        );

        setPayments((current) => ({
          ...current,
          [rideId]: data.payment,
        }));
      } catch (error) {
        console.error(
          "Unable to load payment:",
          error
        );
      }
    },
    []
  );

  // ============================================
  // CREATE PAYMENT
  // ============================================

  const payForRide = async (
    rideId: number
  ) => {
    try {
      setMessage("");

      const data = await apiFetch(
        "/payments",
        {
          method: "POST",

          body: JSON.stringify({
            rideId,
          }),
        }
      );

      setPayments((current) => ({
        ...current,
        [rideId]: data.payment,
      }));

      setMessage(
        "Payment initiated. Use the mock webhook to complete it."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Payment failed"
      );
    }
  };

  // ============================================
  // LOAD USER FROM LOCAL STORAGE
  // ============================================

  useEffect(() => {
    const savedUser =
      localStorage.getItem("user");

    const token =
      localStorage.getItem("token");

    if (!token || !savedUser) {
      router.push("/login");
      return;
    }

    try {
      const parsedUser: User =
        JSON.parse(savedUser);

      if (parsedUser.role !== "CUSTOMER") {
        router.push("/login");
        return;
      }

      setUser(parsedUser);
    } catch {
      localStorage.removeItem("user");
      localStorage.removeItem("token");

      router.push("/login");
    }
  }, [router]);

  // ============================================
  // LOAD RIDES
  // ============================================

  useEffect(() => {
    loadRides();
  }, [loadRides]);

  // ============================================
  // LOAD PAYMENTS FOR COMPLETED RIDES
  // ============================================

  useEffect(() => {
    rides.forEach((ride) => {
      if (
        ride.status === "COMPLETED" &&
        payments[ride.id] === undefined
      ) {
        loadPayment(ride.id);
      }
    });
  }, [rides, payments, loadPayment]);

  // ============================================
  // SOCKET CONNECTION
  // ============================================

  useEffect(() => {
    if (!user?.id) return;

    socket.connect();

    socket.emit(
      "join:user",
      user.id
    );

    return () => {
      socket.disconnect();
    };
  }, [user?.id]);

  // ============================================
  // SOCKET RIDE EVENTS
  // ============================================

  useEffect(() => {
    const handleRideAccepted = () => {
      setMessage(
        "Driver accepted your ride."
      );

      loadRides();
    };

    const handleRideArrived = () => {
      setMessage(
        "Your driver has arrived."
      );

      loadRides();
    };

    const handleRideStarted = () => {
      setMessage(
        "Your ride has started."
      );

      loadRides();
    };

    const handleRideCompleted = () => {
      setMessage(
        "Ride completed."
      );

      loadRides();
    };

    socket.on(
      "ride:accepted",
      handleRideAccepted
    );

    socket.on(
      "ride:arrived",
      handleRideArrived
    );

    socket.on(
      "ride:started",
      handleRideStarted
    );

    socket.on(
      "ride:completed",
      handleRideCompleted
    );

    return () => {
      socket.off(
        "ride:accepted",
        handleRideAccepted
      );

      socket.off(
        "ride:arrived",
        handleRideArrived
      );

      socket.off(
        "ride:started",
        handleRideStarted
      );

      socket.off(
        "ride:completed",
        handleRideCompleted
      );
    };
  }, [loadRides]);

  // ============================================
  // REQUEST RIDE
  // ============================================

  const handleBookRide = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    try {
      setBooking(true);
      setMessage("");

      await apiFetch(
        "/rides",
        {
          method: "POST",

          body: JSON.stringify({
            pickupAddress,
            dropAddress,
          }),
        }
      );

      setPickupAddress("");
      setDropAddress("");

      setMessage(
        "Ride requested successfully."
      );

      await loadRides();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to request ride"
      );
    } finally {
      setBooking(false);
    }
  };

  // ============================================
  // LOGOUT
  // ============================================

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    socket.disconnect();

    router.push("/login");
  };

  // ============================================
  // ACTIVE RIDE
  // ============================================

  const activeRide = rides.find(
    (ride) =>
      [
        "SEARCHING",
        "DRIVER_ASSIGNED",
        "DRIVER_ARRIVED",
        "IN_PROGRESS",
      ].includes(ride.status)
  );

  // ============================================
  // JSX
  // ============================================

  return (
    <main className="min-h-screen bg-gray-100">

      {/* ========================================
          NAVBAR
      ======================================== */}

      <nav className="flex items-center justify-between bg-white px-8 py-5 shadow-sm">
        <h1 className="text-2xl font-bold">
          RideAI 🚕
        </h1>

        <div className="flex items-center gap-5">
          <span className="text-gray-600">
            Hi, {user?.name || "Customer"}
          </span>

          <button
            onClick={logout}
            className="rounded-lg border px-4 py-2 hover:bg-gray-100"
          >
            Logout
          </button>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl p-6 md:p-10">

        {/* ========================================
            BOOK RIDE
        ======================================== */}

        {!activeRide && (
          <section className="mb-8 rounded-2xl bg-white p-7 shadow-sm">

            <h2 className="text-2xl font-bold">
              Where are you going?
            </h2>

            <p className="mt-2 text-gray-500">
              Enter your pickup and destination.
            </p>

            <form
              onSubmit={handleBookRide}
              className="mt-6 space-y-4"
            >
              {/* PICKUP */}

              <div>
                <label className="mb-1 block font-medium">
                  Pickup
                </label>

                <input
                  value={pickupAddress}
                  onChange={(e) =>
                    setPickupAddress(
                      e.target.value
                    )
                  }
                  placeholder="Gautam Buddha University"
                  className="w-full rounded-lg border p-3"
                  required
                />
              </div>

              {/* DESTINATION */}

              <div>
                <label className="mb-1 block font-medium">
                  Destination
                </label>

                <input
                  value={dropAddress}
                  onChange={(e) =>
                    setDropAddress(
                      e.target.value
                    )
                  }
                  placeholder="Pari Chowk"
                  className="w-full rounded-lg border p-3"
                  required
                />
              </div>

              {/* FARE */}

              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-500">
                  Phase 4 demo fare
                </p>

                <p className="text-2xl font-bold">
                  ₹150
                </p>

                <p className="mt-1 text-xs text-gray-400">
                  Distance-based pricing will
                  be added with Maps later.
                </p>
              </div>

              {/* REQUEST BUTTON */}

              <button
                type="submit"
                disabled={booking}
                className="w-full rounded-lg bg-black p-3 font-medium text-white disabled:opacity-50"
              >
                {booking
                  ? "Requesting Ride..."
                  : "Request Ride"}
              </button>
            </form>
          </section>
        )}

        {/* ========================================
            MESSAGE
        ======================================== */}

        {message && (
          <div className="mb-6 rounded-lg bg-white p-4 shadow-sm">
            {message}
          </div>
        )}

        {/* ========================================
            ACTIVE RIDE
        ======================================== */}

        {activeRide && (
          <section className="mb-8 rounded-2xl bg-white p-7 shadow-sm">

            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">
                Current Ride
              </h2>

              <StatusBadge
                status={activeRide.status}
              />
            </div>

            <div className="mt-6 space-y-4">

              {/* PICKUP */}

              <div>
                <p className="text-sm text-gray-500">
                  Pickup
                </p>

                <p className="text-lg font-medium">
                  {activeRide.pickup_address}
                </p>
              </div>

              {/* DESTINATION */}

              <div>
                <p className="text-sm text-gray-500">
                  Destination
                </p>

                <p className="text-lg font-medium">
                  {activeRide.drop_address}
                </p>
              </div>

              {/* FARE */}

              <div>
                <p className="text-sm text-gray-500">
                  Estimated Fare
                </p>

                <p className="font-medium">
                  ₹{activeRide.estimated_fare}
                </p>
              </div>

              {/* SEARCHING */}

              {activeRide.status ===
                "SEARCHING" && (
                <div className="rounded-lg bg-yellow-50 p-4">
                  Searching for an available
                  driver...
                </div>
              )}

              {/* DRIVER INFORMATION */}

              {activeRide.driver_name && (
                <div className="rounded-xl border p-4">

                  <h3 className="font-semibold">
                    Your Driver
                  </h3>

                  <p className="mt-2">
                    {activeRide.driver_name}
                  </p>

                  {activeRide.brand && (
                    <p className="text-gray-600">
                      {activeRide.brand}{" "}
                      {activeRide.model}
                    </p>
                  )}

                  {activeRide.vehicle_number && (
                    <p className="text-gray-600">
                      {
                        activeRide.vehicle_number
                      }
                    </p>
                  )}
                </div>
              )}

              {/* REFRESH */}

              <button
                onClick={loadRides}
                className="rounded-lg border px-5 py-2 hover:bg-gray-100"
              >
                Refresh Status
              </button>
            </div>
          </section>
        )}

        {/* ========================================
            RIDE HISTORY
        ======================================== */}

        <section className="rounded-2xl bg-white p-7 shadow-sm">

          <div className="flex items-center justify-between">

            <h2 className="text-2xl font-bold">
              Your Rides
            </h2>

            <button
              onClick={loadRides}
              className="text-sm font-medium underline"
            >
              Refresh
            </button>
          </div>

          {/* LOADING */}

          {loading ? (
            <p className="mt-5">
              Loading rides...
            </p>
          ) : rides.length === 0 ? (
            <p className="mt-5 text-gray-500">
              You haven't booked any rides yet.
            </p>
          ) : (
            <div className="mt-6 space-y-4">

              {rides.map((ride) => (
                <div
                  key={ride.id}
                  className="rounded-xl border p-5"
                >

                  {/* RIDE INFORMATION */}

                  <div className="flex items-start justify-between gap-4">

                    <div>
                      <p className="font-semibold">
                        {
                          ride.pickup_address
                        }
                      </p>

                      <p className="my-1 text-gray-400">
                        ↓
                      </p>

                      <p className="font-semibold">
                        {
                          ride.drop_address
                        }
                      </p>
                    </div>

                    <StatusBadge
                      status={ride.status}
                    />
                  </div>

                  {/* FARE */}

                  <div className="mt-4 flex items-center justify-between border-t pt-4">

                    <span className="text-gray-500">
                      Ride #{ride.id}
                    </span>

                    <span className="font-semibold">
                      ₹
                      {ride.final_fare ||
                        ride.estimated_fare}
                    </span>
                  </div>

                  {/* =================================
                      PAYMENT
                  ================================= */}

                  {ride.status ===
                    "COMPLETED" && (
                    <div className="mt-4 border-t pt-4">

                      {/* NO PAYMENT */}

                      {!payments[ride.id] && (
                        <button
                          onClick={() =>
                            payForRide(
                              ride.id
                            )
                          }
                          className="rounded-lg bg-black px-5 py-2 text-white"
                        >
                          Pay ₹
                          {ride.final_fare ||
                            ride.estimated_fare}
                        </button>
                      )}

                      {/* PENDING */}

                      {payments[ride.id]
                        ?.status ===
                        "PENDING" && (
                        <span className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-700">
                          Payment Pending
                        </span>
                      )}

                      {/* SUCCESS */}

                      {payments[ride.id]
                        ?.status ===
                        "SUCCESS" && (
                        <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                          Paid
                        </span>
                      )}

                      {/* FAILED */}

                      {payments[ride.id]
                        ?.status ===
                        "FAILED" && (
                        <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
                          Payment Failed
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

// ============================================
// STATUS BADGE
// ============================================

function StatusBadge({
  status,
}: {
  status: Ride["status"];
}) {
  const classes: Record<
    Ride["status"],
    string
  > = {
    SEARCHING:
      "bg-yellow-100 text-yellow-700",

    DRIVER_ASSIGNED:
      "bg-blue-100 text-blue-700",

    DRIVER_ARRIVED:
      "bg-purple-100 text-purple-700",

    IN_PROGRESS:
      "bg-orange-100 text-orange-700",

    COMPLETED:
      "bg-green-100 text-green-700",

    CANCELLED:
      "bg-red-100 text-red-700",
  };

  const labels: Record<
    Ride["status"],
    string
  > = {
    SEARCHING: "Searching",
    DRIVER_ASSIGNED:
      "Driver Assigned",
    DRIVER_ARRIVED:
      "Driver Arrived",
    IN_PROGRESS:
      "In Progress",
    COMPLETED:
      "Completed",
    CANCELLED:
      "Cancelled",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${classes[status]}`}
    >
      {labels[status]}
    </span>
  );
}