import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold text-gray-900">Page not found</h1>
      <p className="text-gray-500">The page you're looking for doesn't exist.</p>
      <Link
        href="/"
        className="rounded-md bg-[#C8A45A] px-4 py-2 text-sm font-medium text-[#1A0F28] hover:bg-[#D4A574]"
      >
        Go home
      </Link>
    </div>
  );
}
