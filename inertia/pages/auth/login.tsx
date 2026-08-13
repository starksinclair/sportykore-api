export default function Login() {
  return (
    <div className="form-container">
      <div>
        <h1> Login </h1>
        <p>Enter your details below to login to your account</p>
      </div>

      <div>
        <form method="post" action="/secret-santa">
          <div>
            <label htmlFor="password">Password</label>
            <input
              type="password"
              name="password"
              id="password"
              autoComplete="current-password"
            />
          </div>

          <div>
            <button type="submit" className="button">
              Unlock dashboard
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
