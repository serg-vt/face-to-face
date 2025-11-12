import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { MediaProvider } from './contexts/MediaContext'
import LandingPage from './pages/landing'
import MeetingPage from './pages/meeting'
import './App.scss'

function App() {
  return (
    <MediaProvider>
      <Router>
        <div className="app">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/meeting/:roomId" element={<MeetingPage />} />
          </Routes>
        </div>
      </Router>
    </MediaProvider>
  )
}

export default App
