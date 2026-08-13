import { type RouteConfig, index, route } from '@react-router/dev/routes'

export default [
  index('routes/home.tsx'),
  route('projects', 'routes/projects.tsx'),
  route('projects/create', 'routes/projects.create.tsx'),
  route('projects/:id', 'routes/projects.$id.tsx'),
] satisfies RouteConfig
