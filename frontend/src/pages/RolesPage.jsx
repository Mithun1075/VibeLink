import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import api from '../services/api';

const roles = ['Python Developer', 'Java Developer', 'Frontend Developer', 'Backend Developer', 'Full Stack Developer', 'React Developer', 'Node.js Developer', 'Data Analyst', 'Machine Learning', 'DevOps', 'UI/UX', 'Cyber Security'];

export default function RolesPage() {
  const [waiting, setWaiting] = useState(''); const navigate = useNavigate();
  useEffect(() => { if (!waiting) return undefined; const interval = setInterval(async () => { try { const { data } = await api.post('match/', { role: waiting }); if (data.matched) { clearInterval(interval); navigate(`/meeting/${data.room_code}`); } } catch { clearInterval(interval); } }, 1800); return () => clearInterval(interval); }, [waiting, navigate]);
  if (waiting) return <><Header /><main className="waiting"><div className="spinner" /><p className="eyebrow">MATCHING YOU UP</p><h1>Finding your practice partner…</h1><p>Looking for another <b>{waiting}</b>. Keep this page open.</p><button className="textbtn" onClick={() => setWaiting('')}>Cancel search</button></main></>;
  return <><Header /><main className="rooms"><p className="eyebrow">CHOOSE YOUR FOCUS</p><h1>What are you preparing for?</h1><p className="muted">Pick a role and we’ll match you with someone on the same path.</p><section className="role-grid">{roles.map((role, index) => <article className="role" key={role}><span>{String(index + 1).padStart(2, '0')}</span><h3>{role}</h3><p>Practice tailored interview questions.</p><button onClick={() => setWaiting(role)}>Join room <ArrowRight size={16} /></button></article>)}</section></main></>;
}
