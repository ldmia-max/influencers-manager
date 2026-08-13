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
      <div className="flex">
        {/* Sidebar skeleton */}
        <aside className="hidden md:block w-64 min-h-[calc(100vh-4rem)] border-r bg-white p-4">
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-200 rounded animate-pulse" />
            ))}
          </div>
        </aside>
        {/* Main content skeleton */}
        <main className="flex-1 p-4 md:p-6">
          <div className="space-y-4">
            <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
            <div className="h-64 bg-gray-200 rounded animate-pulse" />
          </div>
        </main>
      </div>
    </>
  );
}
