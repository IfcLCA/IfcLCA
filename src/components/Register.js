import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';

const Register = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const history = useHistory();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        history.push('/auth/login?message=Confirmation email sent. Please check your inbox and possibly your spam folder.');
      } else {
        const errorMessage = await response.text();
        setMessage(errorMessage);
      }
    } catch (error) {
      setMessage('An error occurred during registration.');
    }
  };

  return (
    <div className="container mt-5">
      <div className="card shadow mx-auto" style={{ maxWidth: '850px' }}>
        <div className="card-body">
          <h2 className="card-title text-center mb-4">Register for IfcLCA</h2>
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
            <div className="mb-3 form-check">
              <input
                type="checkbox"
                name="acceptTerms"
                id="acceptTerms"
                className="form-check-input"
                required
              />
              <label htmlFor="acceptTerms" className="form-check-label">
                I agree to the
                <a href="/terms-and-conditions" target="_blank">Terms and Conditions</a>
              </label>
            </div>
            <div className="alert alert-secondary text-center">
              You will receive an email with a confirmation link. Please click it to verify your email address.<br />
              We will keep your email safe and use it for communication on updates, but you can opt out at any time by replying.
            </div>
            <div className="d-grid gap-2">
              <button type="submit" className="btn btn-primary">Register</button>
            </div>
            <div className="text-center mt-3">
              <span>Already have an account? <a href="/auth/login">Login</a></span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Register;
