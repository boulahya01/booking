import { AiFillGithub } from 'react-icons/ai'
import '../styles/About.css'

export function About() {
  return (
    <div className="about-page">
      <div className="about-hero">
        <h1>About booking-frontend</h1>
        <p>Fast booking for campus sports pitches — register, book, and track your reservations.</p>
      </div>

      <div className="about-content">
        <div className="about-section">
          <h2>Source</h2>
          <p>The project is available on GitHub. Contributions and issues are welcome.</p>
          <a className="about-github-link" href="https://github.com/boulahya01/booking" target="_blank" rel="noopener noreferrer">
            <AiFillGithub size={18} /> <span>View on GitHub</span>
          </a>
        </div>

        <div className="about-section">
          <h2>Version</h2>
          <p>v{import.meta.env.REACT_APP_VERSION || '0.0.1'}</p>
        </div>

        <div className="about-section">
          <h2>Contact</h2>
          <p>For help or to report an issue, open a GitHub issue on the repository.</p>
        </div>
      </div>
    </div>
  )
}

export default About
