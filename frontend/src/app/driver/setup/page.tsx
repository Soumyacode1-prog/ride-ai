"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../../lib/api";

export default function DriverSetupPage() {
  const router = useRouter();

  const [licenseNumber, setLicenseNumber] =
    useState("");

  const [vehicle, setVehicle] = useState({
    vehicleNumber: "",
    vehicleType: "SEDAN",
    brand: "",
    model: "",
    color: "",
    capacity: 4,
  });

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    try {
      setLoading(true);
      setMessage("");

      // STEP 1 - create driver profile
      await apiFetch("/drivers/profile", {
        method: "POST",

        body: JSON.stringify({
          licenseNumber,
        }),
      });

      // STEP 2 - add vehicle
      await apiFetch("/drivers/vehicles", {
        method: "POST",

        body: JSON.stringify(vehicle),
      });

      // STEP 3 - go to driver dashboard
      router.push("/driver");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Driver setup failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-900 sm:px-6 lg:py-14">
      <form
        onSubmit={handleSubmit}
        className="mx-auto w-full max-w-2xl space-y-8 rounded-3xl bg-white p-5 shadow-2xl shadow-black/20 sm:p-8 lg:p-10"
      >
        <div className="border-b border-slate-100 pb-6">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-100 text-xl">🚕</span>
            <span className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-600">Ride AI</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Driver Setup
          </h1>

          <p className="mt-2 max-w-lg text-sm leading-6 text-black sm:text-base">
            Complete your profile once and start accepting rides.
          </p>
        </div>

        <section className="space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-orange-600">Step 1</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">Driver information</h2>
          </div>
          <div>
          <label className="mb-2 block text-sm font-semibold text-black">
            Driving License Number
          </label>

          <input
            value={licenseNumber}
            onChange={(e) =>
              setLicenseNumber(e.target.value)
            }
            placeholder="DL12345678"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-100"
            required
          />
        </div>
        </section>

        <section className="space-y-5 border-t border-slate-100 pt-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-orange-600">Step 2</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">Vehicle information</h2>
          </div>

        <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-2 block text-sm font-semibold text-black">
            Vehicle Number
          </label>

          <input
            value={vehicle.vehicleNumber}
            onChange={(e) =>
              setVehicle({
                ...vehicle,
                vehicleNumber: e.target.value,
              })
            }
            placeholder="UP16AB1234"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-100"
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-black">
            Vehicle Type
          </label>

          <select
            value={vehicle.vehicleType}
            onChange={(e) =>
              setVehicle({
                ...vehicle,
                vehicleType: e.target.value,
              })
            }
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 outline-none transition focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-100"
          >
            <option value="BIKE">Bike</option>
            <option value="AUTO">Auto</option>
            <option value="MINI">Mini</option>
            <option value="SEDAN">Sedan</option>
            <option value="SUV">SUV</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-black">
            Brand
          </label>

          <input
            value={vehicle.brand}
            onChange={(e) =>
              setVehicle({
                ...vehicle,
                brand: e.target.value,
              })
            }
            placeholder="Maruti Suzuki"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-100"
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-black">
            Model
          </label>

          <input
            value={vehicle.model}
            onChange={(e) =>
              setVehicle({
                ...vehicle,
                model: e.target.value,
              })
            }
            placeholder="Swift Dzire"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-100"
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-black">
            Color
          </label>

          <input
            value={vehicle.color}
            onChange={(e) =>
              setVehicle({
                ...vehicle,
                color: e.target.value,
              })
            }
            placeholder="White"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-100"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Passenger Capacity
          </label>

          <input
            type="number"
            min="1"
            value={vehicle.capacity}
            onChange={(e) =>
              setVehicle({
                ...vehicle,
                capacity: Number(e.target.value),
              })
            }
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 outline-none transition focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-100"
            required
          />
        </div>
        </div>
        </section>

        {message && (
          <p className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-orange-500 p-3.5 font-semibold text-white shadow-lg shadow-orange-500/25 transition hover:bg-orange-600 focus:outline-none focus:ring-4 focus:ring-orange-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? "Creating profile..."
            : "Complete Setup"}
        </button>
      </form>
    </main>
  );
}
