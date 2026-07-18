import { ArrowRight, CheckCircle2, MessageCircle, Sparkles, Users, Video } from 'lucide-react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';

export default function HomePage() {
  return <><Header /><main><section className="hero"><div><p className="eyebrow">THE INTERVIEW PRACTICE SPACE</p><h1>Practice real interviews with <i>real people.</i></h1><p>Build confidence, sharpen your thinking, and get interview-ready in a place designed for deliberate practice.</p><Link className="primary" to="/rooms">Start practicing <ArrowRight size={18} /></Link><div className="trust"><span><CheckCircle2 /> Free to use</span><span><CheckCircle2 /> Real-time peer sessions</span></div></div><div className="hero-card"><div className="live"><span /> LIVE SESSION</div><div className="avatar">AK</div><h3>Alex Kumar</h3><p>Frontend Developer</p><div className="wave">⌁⌁⌁⌁⌁⌁⌁</div><small>“Tell me about a project you’re proud of.”</small></div></section><section className="features">{[[Video, 'Live video'], [Sparkles, 'AI assistant'], [Users, 'Smart matching'], [MessageCircle, 'Built-in chat']].map(([Icon, title]) => <article key={title}><Icon /><h3>{title}</h3><p>Focused practice tools for your next interview.</p></article>)}</section></main></>;
}
