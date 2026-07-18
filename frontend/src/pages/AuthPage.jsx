import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';

function requestMessage(error) {
  const payload = error.response?.data;
  if (typeof payload?.detail === 'string') return payload.detail;
  if (payload && typeof payload === 'object') {
    const first = Object.values(payload).flat().find(Boolean);
    if (typeof first === 'string') return first;
  }
  return error.message || 'Unable to reach the server.';
}

export default function AuthPage({ mode }) {
  const isRegister = mode === 'register';
  const navigate = useNavigate();
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      if (isRegister) {
        await api.post('auth/register/', form);
        navigate('/login');
      } else {
        const { data } = await api.post('auth/login/', form);
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        navigate('/');
      }
    } catch (requestError) {
      setError(requestMessage(requestError));
    }
  };

  return <main className="auth"><Link className="brand" to="/register">vibe<span>link</span></Link><section className="auth-card"><p className="eyebrow">{isRegister ? 'GET STARTED' : 'WELCOME BACK'}</p><h1>{isRegister ? 'Practice with confidence.' : 'Ready for your next round?'}</h1><p className="muted">{isRegister ? 'Create your free account to begin practicing.' : 'Sign in to continue your interview practice.'}</p><form onSubmit={submit}>{isRegister && <label>Full name<input required name="full_name" onChange={update} /></label>}<label>Email<input required type="email" name="email" onChange={update} /></label><label>Password<input required type="password" name="password" onChange={update} /></label>{isRegister && <label>Confirm password<input required type="password" name="confirm_password" onChange={update} /></label>}{error && <p className="error">{error}</p>}<button className="primary" type="submit">{isRegister ? 'Create account' : 'Log in'} <ArrowRight size={17} /></button></form><p className="switch">{isRegister ? 'Already have an account? ' : 'New to VibeLink? '}<Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Log in' : 'Create an account'}</Link></p></section></main>;
}
