export function LayoutSkeleton() {
  return (
    <>
      {/* Header skeleton */}
      <header className="h-16 border-b bg-white">
        <div className="flex items-center justify-between h-full px-6">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse" />
        </div>
      </header>
      {/* Menu superior skeleton */}
      <nav className="hidden md:flex gap-2 border-b bg-white px-6 py-2">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-9 w-24 bg-gray-200 rounded animate-pulse" />
        ))}
      </nav>
      <div>
        {/* Main content skeleton */}
        <main className="p-4 md:p-6">
          <div className="space-y-4">
            <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
            <div className="h-64 bg-gray-200 rounded animate-pulse" />
          </div>
        </main>
      </div>
    </>
  );
}
