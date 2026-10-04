import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-8 py-5 bg-white border-b">
        <Link href="/">
          <h1 className="text-2xl font-bold">
            RideAI 🚕
          </h1>
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="px-5 py-2 border border-black rounded-lg hover:bg-gray-100"
          >
            Login
          </Link>

          <Link
            href="/register"
            className="px-5 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
          >
            Register
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="flex min-h-[80vh] items-center justify-center px-6">
        <div className="max-w-3xl text-center">
          <h2 className="text-5xl font-bold leading-tight">
            Your ride, when you need it.
          </h2>

          <p className="mt-6 text-lg text-gray-600">
            Book reliable rides, connect with nearby drivers,
            and travel comfortably with RideAI.
          </p>

          <div className="mt-8 flex justify-center gap-4">
            <Link
              href="/register"
              className="rounded-lg bg-black px-7 py-3 text-white hover:bg-gray-800"
            >
              Book a Ride
            </Link>

            <Link
              href="/register"
              className="rounded-lg border border-black px-7 py-3 hover:bg-gray-100"
            >
              Become a Driver
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-white px-8 py-16">
        <h2 className="text-center text-3xl font-bold">
          Why RideAI?
        </h2>

        <div className="mx-auto mt-10 grid max-w-5xl gap-6 md:grid-cols-3">
          <div className="rounded-xl border p-6">
            <h3 className="text-xl font-semibold">
              🚕 Easy Booking
            </h3>

            <p className="mt-3 text-gray-600">
              Request a ride quickly and connect with
              available drivers.
            </p>
          </div>

          <div className="rounded-xl border p-6">
            <h3 className="text-xl font-semibold">
              ⚡ Fast Matching
            </h3>

            <p className="mt-3 text-gray-600">
              Our system finds available drivers for your
              ride request.
            </p>
          </div>

          <div className="rounded-xl border p-6">
            <h3 className="text-xl font-semibold">
              🔒 Secure Platform
            </h3>

            <p className="mt-3 text-gray-600">
              Secure authentication and role-based access
              for customers and drivers.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}