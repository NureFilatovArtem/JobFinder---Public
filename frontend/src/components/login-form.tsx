import { useState } from "react"
import { cn } from "@/lib/utils"
import { useAuth } from "../context/AuthContext"
import { GoogleLogin, CredentialResponse } from "@react-oauth/google"
import AppleSignin from "react-apple-signin-auth"

type AuthMode = "login" | "signup"

interface LoginFormProps extends React.ComponentProps<"div"> {
  initialMode?: AuthMode
  onClose?: () => void
}

export function LoginForm({
  className,
  initialMode = "login",
  onClose,
  ...props
}: LoginFormProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { loginWithEmail, registerWithEmail, loginWithGoogle, loginWithApple } = useAuth() as any

  const isSignup = mode === "signup"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      if (isSignup) {
        await registerWithEmail(email, password, name)
      } else {
        await loginWithEmail(email, password)
      }
      onClose?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (credentialResponse.credential) {
      try {
        await loginWithGoogle(credentialResponse.credential)
        onClose?.()
      } catch (err) {
        setError("Google login failed. Please try again.")
      }
    }
  }

  const handleAppleSuccess = async (response: any) => {
    try {
      if (response.authorization) {
        const { id_token, user } = response.authorization;
        await loginWithApple(id_token, user);
        onClose?.();
      }
    } catch (err) {
      setError("Apple login failed. Please try again.");
    }
  };

  const handleAppleError = (error: any) => {
    console.error("Apple login error:", error);
    setError("Apple login failed. Please try again.");
  };

  const toggleMode = () => {
    setMode(mode === "login" ? "signup" : "login")
    setError(null)
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col items-center gap-2">
            <a
              href="#"
              className="flex flex-col items-center gap-2 font-medium"
            >
              <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-6"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <span className="sr-only">JobFinder</span>
            </a>
            <h1 className="text-xl font-bold">
              {isSignup ? "Create an account" : "Welcome back"}
            </h1>
            <p className="text-center text-sm text-muted-foreground">
              {isSignup
                ? "Sign up for JobFinder"
                : "Login to your JobFinder account"}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Form Fields */}
          <div className="flex flex-col gap-4">
            {isSignup && (
              <div className="grid gap-2">
                <label htmlFor="name" className="text-sm font-medium">
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={isSignup}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            )}

            <div className="grid gap-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="m@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                {!isSignup && (
                  <a
                    href="#"
                    className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                  >
                    Forgot password?
                  </a>
                )}
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              {isLoading ? (
                <svg
                  className="mr-2 size-4 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : null}
              {isSignup ? "Sign up" : "Login"}
            </button>
          </div>

          {/* Divider */}
          <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
            <span className="relative z-10 bg-background px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>

          {/* Social Login Buttons */}
          <div className="grid grid-cols-2 gap-4">
            {/* Apple Login - Custom Wrapper */}
            <div className="relative h-10 overflow-hidden">
              {/* Custom Apple Icon Overlay */}
              <div
                className="absolute inset-0 flex items-center justify-center rounded-md border border-input bg-background transition-colors hover:bg-accent hover:text-accent-foreground z-10"
                style={{ pointerEvents: 'none' }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="size-5"
                >
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
              </div>
              {/* Hidden Apple Sign-In Button */}
              <div style={{ opacity: 0, width: '100%', height: '100%' }}>
                <AppleSignin
                  authOptions={{
                    clientId: import.meta.env.VITE_APPLE_CLIENT_ID || 'com.jobfinder.web',
                    scope: 'email name',
                    redirectURI: import.meta.env.VITE_APPLE_REDIRECT_URI || window.location.origin,
                    state: 'state',
                    nonce: 'nonce',
                    usePopup: true,
                  }}
                  onSuccess={handleAppleSuccess}
                  onError={handleAppleError}
                  uiType="dark"
                  className="apple-auth-btn"
                />
              </div>
            </div>

            {/* Google Login - Custom Wrapper */}
            <div className="relative h-10 overflow-hidden">
              {/* Custom Google Icon Overlay */}
              <div
                className="absolute inset-0 flex items-center justify-center rounded-md border border-input bg-background transition-colors hover:bg-accent hover:text-accent-foreground z-10"
                style={{ pointerEvents: 'none' }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="size-5"
                >
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
              </div>
              {/* Hidden Google Login Button */}
              <div style={{ opacity: 0, width: '100%', height: '100%' }}>
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => {
                    setError("Google login failed. Please try again.")
                  }}
                  useOneTap={false}
                  size="large"
                />
              </div>
            </div>
          </div>

          {/* Toggle Mode Link */}
          <div className="text-center text-sm">
            {isSignup ? (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={toggleMode}
                  className="underline underline-offset-4 hover:text-primary"
                >
                  Login
                </button>
              </>
            ) : (
              <>
                Don&apos;t have an account yet?{" "}
                <button
                  type="button"
                  onClick={toggleMode}
                  className="underline underline-offset-4 hover:text-primary"
                >
                  Create an account
                </button>
              </>
            )}
          </div>
        </div>
      </form>

      {/* Terms */}
      <p className="text-center text-xs text-muted-foreground">
        By clicking continue, you agree to our{" "}
        <a href="#" className="underline underline-offset-4 hover:text-primary">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="#" className="underline underline-offset-4 hover:text-primary">
          Privacy Policy
        </a>
        .
      </p>
    </div>
  )
}
