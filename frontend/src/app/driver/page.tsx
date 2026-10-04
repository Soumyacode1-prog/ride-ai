"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { socket } from "../../lib/socket";

// =====================================
// TYPES
// =====================================

interface Vehicle {
  id: number;
  vehicle_number: string;
  vehicle_type: string;
  brand: string;
  model: string;
  is_active: boolean;
}

interface Driver {
  id: number;

  // Needed for Socket.IO personal room
  user_id: number;

  name: string;
  email: string;
  license_number: string;

  status:
    | "ONLINE"
    | "OFFLINE"
    | "BUSY";

  rating: string;
  total_rides: number;

  vehicles: Vehicle[];
}

interface Ride {
  id: number;

  pickup_address: string;
  drop_address: string;

  estimated_fare: string;

  status:
    | "SEARCHING"
    | "DRIVER_ASSIGNED"
    | "DRIVER_ARRIVED"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "CANCELLED";

  customer_name?: string;
}

// =====================================
// DRIVER PAGE
// =====================================

export default function DriverPage() {
  const router = useRouter();

  const [driver, setDriver] =
    useState<Driver | null>(null);

  const [rideRequests, setRideRequests] =
    useState<Ride[]>([]);

  const [currentRide, setCurrentRide] =
    useState<Ride | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [message, setMessage] =
    useState("");

  // =====================================
  // LOAD DRIVER
  // =====================================

  const loadDriver =
    useCallback(async () => {
      try {
        const data = await apiFetch(
          "/drivers/me"
        );

        setDriver(data.driver);

        return data.driver;
      } catch (error) {
        const msg =
          error instanceof Error
            ? error.message
            : "Unable to load driver";

        if (
          msg ===
          "Driver profile not found"
        ) {
          router.push(
            "/driver/setup"
          );

          return null;
        }

        setMessage(msg);

        return null;
      }
    }, [router]);

  // =====================================
  // LOAD RIDE REQUESTS
  // =====================================

  const loadRideRequests =
    useCallback(async () => {
      try {
        const data = await apiFetch(
          "/drivers/ride-requests"
        );

        setRideRequests(
          data.rides
        );
      } catch (error) {
        const msg =
          error instanceof Error
            ? error.message
            : "Unable to load rides";

        /*
         * Driver being OFFLINE is normal.
         */
        if (
          msg ===
          "You must be online to receive ride requests"
        ) {
          setRideRequests([]);
          return;
        }

        setMessage(msg);
      }
    }, []);

  // =====================================
  // LOAD CURRENT RIDE
  // =====================================

  const loadCurrentRide =
    useCallback(async () => {
      try {
        const data =
          await apiFetch(
            "/drivers/current-ride"
          );

        setCurrentRide(
          data.ride
        );

        return data.ride;
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to load current ride"
        );

        return null;
      }
    }, []);

  // =====================================
  // INITIAL LOAD
  // =====================================

  useEffect(() => {
    const initialize =
      async () => {
        const loadedDriver =
          await loadDriver();

        if (!loadedDriver) {
          setLoading(false);
          return;
        }

        const activeRide =
          await loadCurrentRide();

        if (
          loadedDriver.status ===
            "ONLINE" &&
          !activeRide
        ) {
          await loadRideRequests();
        }

        setLoading(false);
      };

    initialize();
  }, [
    loadDriver,
    loadCurrentRide,
    loadRideRequests,
  ]);

  // =====================================
  // SOCKET.IO CONNECTION
  // =====================================

  useEffect(() => {
    /*
     * Connect driver browser to
     * Socket.IO server.
     */

    socket.connect();

    /*
     * Driver joins general drivers room.
     *
     * Backend can now send:
     *
     * ride:new
     *
     * to all connected drivers.
     */
    socket.emit(
      "join:drivers"
    );

    return () => {
      socket.disconnect();
    };
  }, []);

  // =====================================
  // JOIN PERSONAL DRIVER ROOM
  // =====================================

  useEffect(() => {
    if (!driver?.user_id) {
      return;
    }

    /*
     * Example:
     *
     * user:7
     *
     * This allows backend to send events
     * specifically to this user.
     */

    socket.emit(
      "join:user",
      driver.user_id
    );
  }, [driver?.user_id]);

  // =====================================
  // LISTEN FOR NEW RIDES
  // =====================================

  useEffect(() => {
    const handleNewRide =
      async () => {
        /*
         * Only fetch new rides when
         * driver is currently ONLINE.
         */

        if (
          driver?.status !==
          "ONLINE"
        ) {
          return;
        }

        setMessage(
          "New ride request available!"
        );

        await loadRideRequests();
      };

    socket.on(
      "ride:new",
      handleNewRide
    );

    return () => {
      socket.off(
        "ride:new",
        handleNewRide
      );
    };
  }, [
    driver?.status,
    loadRideRequests,
  ]);

  // =====================================
  // CHANGE ONLINE STATUS
  // =====================================

  const changeStatus = async (
    status:
      | "ONLINE"
      | "OFFLINE"
  ) => {
    try {
      setMessage("");

      const data =
        await apiFetch(
          "/drivers/status",
          {
            method: "PATCH",

            body: JSON.stringify({
              status,
            }),
          }
        );

      setDriver(
        (current) =>
          current
            ? {
                ...current,
                status:
                  data.driver
                    .status,
              }
            : current
      );

      if (
        status === "ONLINE"
      ) {
        await loadRideRequests();
      } else {
        setRideRequests([]);
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to update status"
      );
    }
  };

  // =====================================
  // ACCEPT RIDE
  // =====================================

  const acceptRide = async (
    rideId: number
  ) => {
    try {
      setMessage("");

      const data =
        await apiFetch(
          `/rides/${rideId}/accept`,
          {
            method: "POST",
          }
        );

      setCurrentRide(
        data.ride
      );

      /*
       * Once driver accepts one ride,
       * don't show other available rides.
       */
      setRideRequests([]);

      await loadDriver();

      setMessage(
        "Ride accepted successfully."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to accept ride"
      );

      /*
       * Another driver may have accepted
       * this ride first.
       *
       * Reload available rides.
       */
      await loadRideRequests();
    }
  };

  // =====================================
  // REJECT RIDE
  // =====================================

  const rejectRide = async (
    rideId: number
  ) => {
    try {
      setMessage("");

      await apiFetch(
        `/rides/${rideId}/reject`,
        {
          method: "POST",
        }
      );

      setRideRequests(
        (rides) =>
          rides.filter(
            (ride) =>
              ride.id !==
              rideId
          )
      );

      setMessage(
        "Ride rejected."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to reject ride"
      );
    }
  };

  // =====================================
  // UPDATE RIDE STATUS
  // =====================================

  const updateRide = async (
    action:
      | "arrived"
      | "start"
      | "complete"
  ) => {
    if (!currentRide) {
      return;
    }

    try {
      setMessage("");

      const data =
        await apiFetch(
          `/rides/${currentRide.id}/${action}`,
          {
            method: "PATCH",
          }
        );

      // =================================
      // COMPLETE RIDE
      // =================================

      if (
        action ===
        "complete"
      ) {
        setCurrentRide(null);

        /*
         * Driver should become ONLINE
         * again after completing ride.
         */
        await loadDriver();

        await loadRideRequests();

        setMessage(
          "Ride completed successfully."
        );

        return;
      }

      // =================================
      // ARRIVED / STARTED
      // =================================

      setCurrentRide(
        data.ride
      );

      if (
        action ===
        "arrived"
      ) {
        setMessage(
          "Customer notified that you arrived."
        );
      }

      if (
        action ===
        "start"
      ) {
        setMessage(
          "Ride started."
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to update ride"
      );
    }
  };

  // =====================================
  // LOGOUT
  // =====================================

  const logout = () => {
    /*
     * Disconnect socket before logout.
     */

    socket.disconnect();

    localStorage.removeItem(
      "token"
    );

    localStorage.removeItem(
      "user"
    );

    router.push("/login");
  };

  // =====================================
  // LOADING
  // =====================================

  if (loading) {
    return (
      <main className="p-10">
        Loading driver
        dashboard...
      </main>
    );
  }

  if (!driver) {
    return null;
  }

  // =====================================
  // UI
  // =====================================

  return (
    <main className="min-h-screen bg-gray-100">

      {/* ============================= */}
      {/* NAVBAR */}
      {/* ============================= */}

      <nav className="flex items-center justify-between bg-white px-8 py-5 shadow-sm">

        <div>
          <h1 className="text-2xl font-bold">
            RideAI Driver
          </h1>

          <p className="text-sm text-gray-500">
            Welcome,{" "}
            {driver.name}
          </p>
        </div>

        <button
          onClick={logout}
          className="rounded-lg border px-4 py-2"
        >
          Logout
        </button>

      </nav>

      <div className="mx-auto max-w-6xl p-6 md:p-10">

        {/* ============================= */}
        {/* DRIVER STATUS */}
        {/* ============================= */}

        <section className="mb-8 rounded-2xl bg-white p-6 shadow-sm">

          <div className="flex items-center justify-between">

            <div>
              <h2 className="text-xl font-bold">
                Availability
              </h2>

              <p className="mt-1 text-gray-500">
                Current status:{" "}
                <strong>
                  {driver.status}
                </strong>
              </p>
            </div>

            {driver.status ===
              "OFFLINE" && (
              <button
                onClick={() =>
                  changeStatus(
                    "ONLINE"
                  )
                }
                className="rounded-lg bg-black px-6 py-3 text-white"
              >
                Go Online
              </button>
            )}

            {driver.status ===
              "ONLINE" && (
              <button
                onClick={() =>
                  changeStatus(
                    "OFFLINE"
                  )
                }
                className="rounded-lg border px-6 py-3"
              >
                Go Offline
              </button>
            )}

            {driver.status ===
              "BUSY" && (
              <span className="rounded-full bg-yellow-100 px-4 py-2 font-medium text-yellow-700">
                On Ride
              </span>
            )}

          </div>
        </section>

        {/* ============================= */}
        {/* MESSAGE */}
        {/* ============================= */}

        {message && (
          <div className="mb-6 rounded-lg bg-white p-4 shadow-sm">
            {message}
          </div>
        )}

        {/* ============================= */}
        {/* CURRENT RIDE */}
        {/* ============================= */}

        {currentRide && (
          <section className="mb-8 rounded-2xl bg-white p-6 shadow-sm">

            <h2 className="text-2xl font-bold">
              Current Ride
            </h2>

            <div className="mt-5 rounded-xl border p-5">

              {/* CUSTOMER */}

              {currentRide.customer_name && (
                <div className="mb-5">

                  <p className="text-sm text-gray-500">
                    Customer
                  </p>

                  <p className="font-semibold">
                    {
                      currentRide.customer_name
                    }
                  </p>

                </div>
              )}

              {/* PICKUP */}

              <p className="text-sm text-gray-500">
                Pickup
              </p>

              <p className="font-semibold">
                {
                  currentRide.pickup_address
                }
              </p>

              <p className="my-3 text-gray-400">
                ↓
              </p>

              {/* DESTINATION */}

              <p className="text-sm text-gray-500">
                Destination
              </p>

              <p className="font-semibold">
                {
                  currentRide.drop_address
                }
              </p>

              {/* FARE + STATUS */}

              <div className="mt-5 border-t pt-4">

                <p>
                  Fare:{" "}
                  <strong>
                    ₹
                    {
                      currentRide.estimated_fare
                    }
                  </strong>
                </p>

                <p className="mt-1">
                  Status:{" "}
                  <strong>
                    {
                      currentRide.status
                    }
                  </strong>
                </p>

              </div>

              {/* ======================= */}
              {/* RIDE ACTION BUTTON */}
              {/* ======================= */}

              <div className="mt-6">

                {currentRide.status ===
                  "DRIVER_ASSIGNED" && (
                  <button
                    onClick={() =>
                      updateRide(
                        "arrived"
                      )
                    }
                    className="w-full rounded-lg bg-black p-3 text-white"
                  >
                    I've Arrived
                  </button>
                )}

                {currentRide.status ===
                  "DRIVER_ARRIVED" && (
                  <button
                    onClick={() =>
                      updateRide(
                        "start"
                      )
                    }
                    className="w-full rounded-lg bg-black p-3 text-white"
                  >
                    Start Ride
                  </button>
                )}

                {currentRide.status ===
                  "IN_PROGRESS" && (
                  <button
                    onClick={() =>
                      updateRide(
                        "complete"
                      )
                    }
                    className="w-full rounded-lg bg-green-600 p-3 text-white"
                  >
                    Complete Ride
                  </button>
                )}

              </div>

            </div>
          </section>
        )}

        {/* ============================= */}
        {/* AVAILABLE RIDES */}
        {/* ============================= */}

        {driver.status ===
          "ONLINE" &&
          !currentRide && (
          <section className="rounded-2xl bg-white p-6 shadow-sm">

            <div className="flex items-center justify-between">

              <div>
                <h2 className="text-2xl font-bold">
                  Ride Requests
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  New rides will appear automatically.
                </p>
              </div>

              {/*
                We can keep Refresh as a
                fallback even though Socket.IO
                updates automatically.
              */}

              <button
                onClick={
                  loadRideRequests
                }
                className="rounded-lg border px-4 py-2"
              >
                Refresh
              </button>

            </div>

            {rideRequests.length ===
            0 ? (
              <p className="mt-5 text-gray-500">
                No ride requests
                available.
              </p>
            ) : (
              <div className="mt-6 space-y-4">

                {rideRequests.map(
                  (ride) => (
                    <div
                      key={ride.id}
                      className="rounded-xl border p-5"
                    >

                      {/* CUSTOMER + FARE */}

                      <div className="flex justify-between gap-4">

                        <div>
                          <p className="text-sm text-gray-500">
                            Customer
                          </p>

                          <p className="font-semibold">
                            {
                              ride.customer_name
                            }
                          </p>
                        </div>

                        <p className="text-xl font-bold">
                          ₹
                          {
                            ride.estimated_fare
                          }
                        </p>

                      </div>

                      {/* ROUTE */}

                      <div className="mt-5">

                        <p className="text-sm text-gray-500">
                          Pickup
                        </p>

                        <p className="font-medium">
                          {
                            ride.pickup_address
                          }
                        </p>

                        <p className="my-2 text-gray-400">
                          ↓
                        </p>

                        <p className="text-sm text-gray-500">
                          Destination
                        </p>

                        <p className="font-medium">
                          {
                            ride.drop_address
                          }
                        </p>

                      </div>

                      {/* ACTIONS */}

                      <div className="mt-6 flex gap-3">

                        <button
                          onClick={() =>
                            rejectRide(
                              ride.id
                            )
                          }
                          className="flex-1 rounded-lg border border-red-500 p-3 text-red-500"
                        >
                          Reject
                        </button>

                        <button
                          onClick={() =>
                            acceptRide(
                              ride.id
                            )
                          }
                          className="flex-1 rounded-lg bg-black p-3 text-white"
                        >
                          Accept
                        </button>

                      </div>

                    </div>
                  )
                )}

              </div>
            )}

          </section>
        )}

        {/* ============================= */}
        {/* DRIVER INFORMATION */}
        {/* ============================= */}

        <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">

          <h2 className="text-xl font-bold">
            Driver Information
          </h2>

          <div className="mt-4 grid gap-4 md:grid-cols-3">

            {/* LICENSE */}

            <div>
              <p className="text-sm text-gray-500">
                License
              </p>

              <p>
                {
                  driver.license_number
                }
              </p>
            </div>

            {/* RATING */}

            <div>
              <p className="text-sm text-gray-500">
                Rating
              </p>

              <p>
                {Number(
                  driver.rating
                ) > 0
                  ? driver.rating
                  : "New Driver"}
              </p>
            </div>

            {/* TOTAL RIDES */}

            <div>
              <p className="text-sm text-gray-500">
                Total Rides
              </p>

              <p>
                {
                  driver.total_rides
                }
              </p>
            </div>

          </div>

        </section>

      </div>
    </main>
  );
}