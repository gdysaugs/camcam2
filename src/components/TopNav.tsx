import { NavLink } from 'react-router-dom'

export function TopNav() {
  return (
    <nav className="top-nav">
      <NavLink to="/" className={({ isActive }) => `top-nav__link${isActive ? ' is-active' : ''}`}>
        生成
      </NavLink>
      <NavLink to="/video" className={({ isActive }) => `top-nav__link${isActive ? ' is-active' : ''}`}>
        動画
      </NavLink>
      <NavLink to="/purchase" className={({ isActive }) => `top-nav__link${isActive ? ' is-active' : ''}`}>
        チケット購入
      </NavLink>
    </nav>
  )
}
