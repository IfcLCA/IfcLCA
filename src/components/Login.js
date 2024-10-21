import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const history = useHistory();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        history.push('/');
      } else {
        const errorMessage = await response.text();
        setMessage(errorMessage);
      }
    } catch (error) {
      setMessage('An error occurred during login.');
    }
  };

  return (
    <div className="container mt-5">
      <div className="card shadow mx-auto" style={{ maxWidth: '850px' }}>
        <div className="card-body">
          <h2 className="card-title text-center mb-4">Login to IfcLCA</h2>
          {message && <div className="alert alert-info text-center">{message}</div>}
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="username" className="form-label">Email Address</label>
              <input
                type="email"
                name="username"
                placeholder="Email"
                required
                className="form-control"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="mb-3">
              <label htmlFor="password" className="form-label">Password</label>
              <input
                type="password"
                name="password"
                placeholder="Password"
                required
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="d-grid gap-2">
              <button type="submit" className="btn btn-primary">Login</button>
            </div>
            <div className="text-center mt-3">
              <span>Don't have an account? <a href="/auth/register">Register</a></span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
