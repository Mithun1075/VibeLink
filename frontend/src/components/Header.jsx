import { LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function Header() {
  const navigate = useNavigate();
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return <header><Link className="brand" to="/">vibe<span>link</span></Link><nav><Link to="/">Home</Link><Link to="/rooms">Practice</Link></nav><button className="logout" onClick={logout}>Log out <LogOut size={16} /></button></header>;
}
