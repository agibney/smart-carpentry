import { type RouteConfig, index, layout, route } from '@react-router/dev/routes'

export default [
  index('routes/home.tsx'),
  route('auth/login', 'routes/auth.login.tsx'),
  route('auth/callback', 'routes/auth.callback.tsx'),
  route('auth/logout', 'routes/auth.logout.tsx'),

  // Signed-in pages, rendered inside the Sakai layout shell (topbar + role-based sidebar).
  layout('routes/app-shell.tsx', [
    route('dashboard', 'routes/dashboard.tsx'),
    route('projects', 'routes/projects.tsx'),
    route('projects/create', 'routes/projects.create.tsx'),
    route('projects/:id', 'routes/projects.$id.tsx'),
    route('admin/dashboard', 'routes/admin.dashboard.tsx'),
    route('admin/businesses', 'routes/admin.businesses.tsx'),
  ]),
] satisfies RouteConfig
