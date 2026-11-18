/**
 * CollabLoop Browser Router Navigation Utilities
 * Provides URL parsing and browser history manipulation for:
 *   - Dashboard: /
 *   - Project Detail (Role Listing): /projects/:projectId
 *   - Role Detail (Role Workspace): /projects/:projectId/roles/:roleId
 * (Supports /projects/:projectId/workspaces/:roleId and ?role=:roleId for compatibility)
 */

/**
 * Parse project ID and optional role ID from a pathname and query string.
 * @param {string} [pathname] - Pathname to parse (defaults to window.location.pathname)
 * @param {string} [search] - Search query string (defaults to window.location.search)
 * @returns {{ projectId: string | null, roleId: string | null }}
 */
export function parseProjectRoute(
  pathname = window.location.pathname,
  search = window.location.search
) {
  // Matches:
  // /projects/:projectId
  // /projects/:projectId/roles/:roleId
  // /projects/:projectId/workspaces/:roleId
  const match = pathname.match(
    /^\/projects\/([a-f0-9]{24})(?:\/(?:roles|workspaces)\/([^/?#]+))?\/?$/i
  );

  if (match) {
    let roleId = match[2] ? decodeURIComponent(match[2]) : null;
    if (!roleId && search) {
      const params = new URLSearchParams(search);
      roleId = params.get('role') || params.get('workspace') || params.get('roleId');
    }
    return {
      projectId: match[1],
      roleId: roleId || null,
    };
  }

  return { projectId: null, roleId: null };
}

/**
 * Build the canonical URL string for a project and optional role.
 * @param {string | null} projectId
 * @param {string | null} [roleId]
 * @returns {string}
 */
export function buildProjectUrl(projectId, roleId = null) {
  if (!projectId) return '/';
  if (roleId) {
    return `/projects/${projectId}/roles/${encodeURIComponent(roleId)}`;
  }
  return `/projects/${projectId}`;
}

/**
 * Push a new URL into browser history (adds a new history entry).
 * @param {string | null} projectId
 * @param {string | null} [roleId]
 */
export function pushProjectUrl(projectId, roleId = null) {
  const target = buildProjectUrl(projectId, roleId);
  const current = window.location.pathname + (window.location.search || '');
  if (current !== target) {
    window.history.pushState({ projectId: projectId || null, roleId: roleId || null }, '', target);
  }
}

/**
 * Replace the current URL in browser history (does not add a new history entry).
 * @param {string | null} projectId
 * @param {string | null} [roleId]
 */
export function replaceProjectUrl(projectId, roleId = null) {
  const target = buildProjectUrl(projectId, roleId);
  const current = window.location.pathname + (window.location.search || '');
  if (current !== target) {
    window.history.replaceState({ projectId: projectId || null, roleId: roleId || null }, '', target);
  }
}
