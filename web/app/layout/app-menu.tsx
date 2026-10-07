import { classNames } from 'primereact/utils'
import { NavLink } from 'react-router'
import type { MenuSection } from '../lib/menu'

// Ported from Sakai's AppMenu/AppMenuitem, cut down to what our menus use: labelled root
// sections of plain links. Sakai's collapsible nested submenus (MenuContext + CSSTransition)
// aren't ported — nothing here nests yet. NavLink's isActive replaces Sakai's own
// pathname-matching for the `active-route` highlight.
export function AppMenu({ model }: { model: MenuSection[] }) {
  return (
    <ul className="layout-menu">
      {model.map((section) => (
        <li key={section.label} className="layout-root-menuitem">
          <div className="layout-menuitem-root-text">{section.label}</div>
          <ul>
            {section.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => classNames({ 'active-route': isActive })}
                >
                  <i className={classNames('layout-menuitem-icon', item.icon)} />
                  <span className="layout-menuitem-text">{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}
