import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">workclock</h1>
      <Link href="/docs/" className="underline">
        Read the docs
      </Link>
    </main>
  );
}
