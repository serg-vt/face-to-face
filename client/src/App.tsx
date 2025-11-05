import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/landing'
import MeetingPage from './pages/meeting'
import styles from './App.module.scss'

function App() {
  return (
    <Router>
      <div className={styles.app}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/meeting/:roomId" element={<MeetingPage />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
