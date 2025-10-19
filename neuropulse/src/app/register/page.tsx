'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('patient');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role }),
      });

      if (response.ok) {
        router.push('/login');
      } else {
        const data = await response.json();
        setError(data.error || 'Registration failed');
      }
    } catch (err) {
      setError('An error occurred');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="glass p-8 rounded-lg w-full max-w-md">
        <h1 className="text-2xl font-bold text-primary mb-6">Register</h1>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-primary mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-text"
              required
            />
          </div>
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
          <div className="mb-4">
            <label className="block text-sm font-medium text-primary mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-text"
              required
            />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-primary mb-2">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-text"
            >
              <option value="patient">Patient</option>
              <option value="doctor">Doctor</option>
              <option value="caretaker">Caretaker</option>
            </select>
          </div>
          {error && <p className="text-danger mb-4">{error}</p>}
          <button
            type="submit"
            className="w-full bg-primary text-surface py-2 rounded-lg font-semibold hover:bg-primary/90"
          >
            Register
          </button>
        </form>
        <p className="mt-4 text-sm text-muted-foreground">
          Already have an account? <Link href="/login" className="text-primary">Login</Link>
        </p>
      </div>
    </div>
  );
}
