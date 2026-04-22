import { Outlet, NavLink } from 'react-router-dom';

const steps = [
  { path: '/', label: '1. Connect Orgs' },
  { path: '/select', label: '2. Select Objects' },
];

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-700 text-white shadow">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">Digital Insurance Product Catalog Data Migrator</h1>
          <nav className="flex gap-6 text-sm">
            {steps.map((s) => (
              <NavLink
                key={s.path}
                to={s.path}
                end
                className={({ isActive }) =>
                  isActive ? 'font-semibold underline underline-offset-4' : 'opacity-80 hover:opacity-100'
                }
              >
                {s.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
