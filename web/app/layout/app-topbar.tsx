import { classNames } from 'primereact/utils'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'

type Props = {
  userLabel: string
  homePath: string
  onMenuToggle: () => void
  // Whether the sidebar is currently shown, and its element id — for the menu toggle's ARIA state.
  menuExpanded: boolean
  sidebarId: string
}

const TOPBAR_MENU_ID = 'layout-topbar-menu'

// Ported from Sakai's AppTopbar. Sakai's demo Calendar/Profile/Settings buttons are replaced by
// the signed-in user and a Log out button. The narrow-screen dropdown (the ellipsis button)
// keeps its open/closed state here instead of in Sakai's shared LayoutContext, since nothing
// outside the topbar reads it.
export function AppTopbar({ userLabel, homePath, onMenuToggle, menuExpanded, sidebarId }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const location = useLocation()

  useEffect(() => setMenuOpen(false), [location.pathname])

  // Close the dropdown on a click anywhere outside it (or its toggle button), or on Escape —
  // which also returns focus to the toggle, since focus may be inside the closing dropdown.
  useEffect(() => {
    if (!menuOpen) return
    const onClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (!menuRef.current?.contains(target) && !menuButtonRef.current?.contains(target)) {
        setMenuOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setMenuOpen(false)
      menuButtonRef.current?.focus()
    }
    document.addEventListener('click', onClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  return (
    <div className="layout-topbar">
      <Link to={homePath} className="layout-topbar-logo">
        <i className="pi pi-hammer layout-topbar-logo-icon" />
        <span>Smart Carpentry</span>
      </Link>

      <button
        type="button"
        className="p-link layout-menu-button layout-topbar-button"
        onClick={onMenuToggle}
        aria-label="Toggle menu"
        aria-expanded={menuExpanded}
        aria-controls={sidebarId}
      >
        <i className="pi pi-bars" />
      </button>

      <button
        ref={menuButtonRef}
        type="button"
        className="p-link layout-topbar-menu-button layout-topbar-button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-label="Account menu"
        aria-expanded={menuOpen}
        aria-controls={TOPBAR_MENU_ID}
      >
        <i className="pi pi-ellipsis-v" />
      </button>

      <div ref={menuRef} id={TOPBAR_MENU_ID} className={classNames('layout-topbar-menu', { 'layout-topbar-menu-mobile-active': menuOpen })}>
        <span className="layout-topbar-user">
          <i className="pi pi-user" />
          {userLabel}
        </span>
        {/* A plain <a>, not <Link>: logout ends in a redirect to Keycloak's end-session
            endpoint, which needs a full-page navigation rather than a client-side fetch. */}
        <a href="/auth/logout" className="p-link layout-topbar-button" title="Log out" aria-label="Log out">
          <i className="pi pi-sign-out" />
          <span>Log out</span>
        </a>
      </div>
    </div>
  )
}
