'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        router.push('/dashboard');
      } else {
        const data = await response.json();
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('An error occurred');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="glass p-8 rounded-lg w-full max-w-md">
        <h1 className="text-2xl font-bold text-primary mb-6">Login</h1>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-primary mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-text"
              required
            />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-primary mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-text"
              required
            />
          </div>
          {error && <p className="text-danger mb-4">{error}</p>}
          <button
            type="submit"
            className="w-full bg-primary text-surface py-2 rounded-lg font-semibold hover:bg-primary/90"
          >
            Login
          </button>
        </form>
        <p className="mt-4 text-sm text-muted-foreground">
          Don't have an account? <Link href="/register" className="text-primary">Register</Link>
        </p>
      </div>
    </div>
  );
}
