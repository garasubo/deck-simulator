import { Link } from 'react-router-dom';
import './Navbar.css';

const Navbar = () => {
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/">Deck Simulator</Link>
      </div>
      <ul className="navbar-menu">
        <li className="navbar-item">
          <Link to="/">Home</Link>
        </li>
        <li className="navbar-item">
          <a href="https://twitter.com/garasubo" target="_blank" rel="noopener noreferrer">Twitter</a>
        </li>
      </ul>
    </nav>
  );
};

export default Navbar;
