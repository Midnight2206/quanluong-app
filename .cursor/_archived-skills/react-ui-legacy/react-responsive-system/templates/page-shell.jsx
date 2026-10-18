export function ResponsivePageShell({ header, sidebar, children }) {
  return (
    <div className="page-shell">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-5 lg:flex-row lg:gap-6 lg:px-6">
        {sidebar}
        <main className="min-w-0 flex-1 space-y-4 lg:space-y-6">
          {header}
          {children}
        </main>
      </div>
    </div>
  );
}
