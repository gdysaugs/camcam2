import { Navigate, Route, Routes } from 'react-router-dom'
import { Account } from './pages/Account'
import { Camera } from './pages/Camera'
import { Image } from './pages/Image'
import { Purchase } from './pages/Purchase'
import { Video } from './pages/Video'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Camera />} />
      <Route path="/image" element={<Image />} />
      <Route path="/purchase" element={<Purchase />} />
      <Route path="/video" element={<Video />} />
      <Route path="/account" element={<Account />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
