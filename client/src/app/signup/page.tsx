"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import toast, { Toaster } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { signup } from "@/service/auth";
import { useAuth } from "@/context/AuthContext";

const signupSchema = z.object({
  username: z.string().min(3, { message: "Username must be at least 3 characters" }).max(20, { message: "Username must be at most 20 characters" }),
  email: z.email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

// Predefined particle positions and animations to avoid hydration mismatches
const predefinedParticles = [
  { left: "10%", top: "20%", duration: "8s", delay: "0.5s" },
  { left: "25%", top: "60%", duration: "12s", delay: "1.2s" },
  { left: "40%", top: "30%", duration: "10s", delay: "0.8s" },
  { left: "55%", top: "80%", duration: "15s", delay: "2.1s" },
  { left: "70%", top: "40%", duration: "9s", delay: "1.5s" },
  { left: "85%", top: "70%", duration: "11s", delay: "0.9s" },
  { left: "15%", top: "85%", duration: "14s", delay: "2.3s" },
  { left: "30%", top: "15%", duration: "7s", delay: "0.3s" },
  { left: "45%", top: "55%", duration: "13s", delay: "1.8s" },
  { left: "60%", top: "25%", duration: "8.5s", delay: "0.7s" },
  { left: "75%", top: "65%", duration: "11.5s", delay: "1.9s" },
  { left: "90%", top: "35%", duration: "9.5s", delay: "1.1s" },
  { left: "20%", top: "45%", duration: "12.5s", delay: "2.0s" },
  { left: "35%", top: "75%", duration: "10.5s", delay: "0.6s" },
  { left: "50%", top: "10%", duration: "16s", delay: "2.4s" },
];

export default function SignupPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [formData, setFormData] = React.useState({
    username: "",
    email: "",
    password: "",
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [mousePosition, setMousePosition] = React.useState({ x: 0, y: 0 });
  const [cursorVariant, setCursorVariant] = React.useState("default");
  const [isMounted, setIsMounted] = React.useState(false);
  const [redirecting, setRedirecting] = React.useState(false);

  // Check if user is already authenticated and redirect
  React.useEffect(() => {
    if (!loading && user) {
      setRedirecting(true);
      router.push('/');
    }
  }, [user, loading, router]);

  // Set mounted state to avoid hydration issues
  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // Mouse movement tracker - only run on client
  React.useEffect(() => {
    if (!isMounted) return;

    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    const handleMouseEnter = () => setCursorVariant("default");
    const handleMouseLeave = () => setCursorVariant("hidden");

    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseenter", handleMouseEnter);
    document.addEventListener("mouseleave", handleMouseLeave);

    // Change cursor on interactive elements
    const interactiveElements = document.querySelectorAll("button, input, a");
    interactiveElements.forEach(el => {
      el.addEventListener("mouseenter", () => setCursorVariant("interactive"));
      el.addEventListener("mouseleave", () => setCursorVariant("default"));
    });

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseenter", handleMouseEnter);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [isMounted]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const validationResult = signupSchema.safeParse(formData);

    if (!validationResult.success) {
      for (const issue of validationResult.error.issues) {
        toast.error(issue.message);
      }
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await signup(formData.username, formData.email, formData.password);
      console.log(res);
      toast.success("Account created successfully!");
      setTimeout(() => router.push("/login"), 1500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading state while checking authentication or redirecting
  if (loading || redirecting) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-purple-900 to-black">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
          <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-bounce"></div>
          <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-cyan-600 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-ping"></div>
        </div>
        
        <div className="relative z-10 flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mb-4"></div>
          <p className="text-white text-sm opacity-70">
            {redirecting ? "Redirecting..." : "Loading..."}
          </p>
        </div>
      </div>
    );
  }

  // Don't render signup form if user is authenticated
  if (user) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-black via-purple-900 to-black">
        {/* Animated gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-bounce"></div>
        <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-cyan-600 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-ping"></div>
        
        {/* Floating particles - using predefined values to avoid hydration issues */}
        {predefinedParticles.map((particle, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full opacity-30"
            style={{
              left: particle.left,
              top: particle.top,
              animation: `float ${particle.duration} infinite ease-in-out`,
              animationDelay: particle.delay,
            }}
          />
        ))}

        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
      </div>

      {/* Custom Animated Cursor - only render on client */}
      {isMounted && (
        <div
          className={`fixed pointer-events-none z-50 transition-transform duration-100 ease-out ${
            cursorVariant === "hidden" ? "opacity-0" : "opacity-100"
          }`}
          style={{
            left: `${mousePosition.x}px`,
            top: `${mousePosition.y}px`,
            transform: `translate(-50%, -50%) scale(${
              cursorVariant === "interactive" ? 2 : 1
            })`,
          }}
        >
          <div className="relative">
            {/* Main cursor dot */}
            <div className={`w-3 h-3 bg-white rounded-full transition-all duration-200 ${
              cursorVariant === "interactive" ? "bg-blue-400 scale-150" : ""
            }`}></div>
            
            {/* Pulsing ring */}
            <div className={`absolute inset-0 border-2 border-white rounded-full animate-ping ${
              cursorVariant === "interactive" ? "border-blue-300" : ""
            }`}></div>
            
            {/* Outer ring */}
            <div className={`absolute inset-0 border border-gray-400 rounded-full transition-all duration-300 ${
              cursorVariant === "interactive" ? "scale-150 border-blue-200" : ""
            }`}></div>
          </div>
        </div>
      )}

      <Toaster position="top-right" reverseOrder={false} />

      <div className="w-full max-w-md relative z-10">
        <div className="bg-gray-950/80 backdrop-blur-xl border border-gray-800 rounded-2xl shadow-2xl p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-50">Create an Account</h1>
            <p className="text-gray-400 mt-2">
              Enter your information to create a new account.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="username" className="text-sm font-medium text-gray-300">
                Full Name
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="name"
                required
                className="mt-1 block w-full rounded-lg border border-gray-700 px-3 py-2 bg-gray-900/50 text-gray-50 focus:border-gray-300 focus:outline-none focus:ring-gray-300 sm:text-sm transition-all duration-200 hover:border-gray-600"
                placeholder="John Doe"
                value={formData.username}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="email" className="text-sm font-medium text-gray-300">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="mt-1 block w-full rounded-lg border border-gray-700 px-3 py-2 bg-gray-900/50 text-gray-50 focus:border-gray-300 focus:outline-none focus:ring-gray-300 sm:text-sm transition-all duration-200 hover:border-gray-600"
                placeholder="name@example.com"
                value={formData.email}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="password" className="text-sm font-medium text-gray-300">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className="mt-1 block w-full rounded-lg border border-gray-700 px-3 py-2 bg-gray-900/50 text-gray-50 focus:border-gray-300 focus:outline-none focus:ring-gray-300 sm:text-sm transition-all duration-200 hover:border-gray-600"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
              />
            </div>

        <Button
  type="submit"
  disabled={isSubmitting}
  className="w-full bg-gradient-to-r from-green-600 to-blue-600 text-white shadow-sm 
             transition-all duration-200 hover:from-green-500 hover:to-blue-500 
             focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 
             focus:ring-offset-gray-950 disabled:opacity-50 disabled:cursor-not-allowed 
             hover:scale-105 transform"
>
  {isSubmitting ? (
    <span className="flex items-center justify-center">
      <svg
        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
        ></circle>
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 
             0 12h4zm2 5.291A7.962 7.962 0 014 
             12H0c0 3.042 1.135 5.824 3 
             7.938l3-2.647z"
        ></path>
      </svg>
      Creating Account...
    </span>
  ) : (
    "Create Account"
  )}
</Button>

          </form>

          <p className="text-center text-sm text-gray-400 pt-4">
            Already have an account?{" "}
            <a href="/login" className="font-semibold text-blue-400 hover:text-blue-300 transition-colors duration-200">
              Sign in
            </a>
          </p>
        </div>
      </div>

      {/* Add custom CSS for animations */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(180deg); }
        }
        
        /* Only hide default cursor on client side */
        body {
          cursor: default;
        }
        
        /* Ensure interactive elements are still clickable */
        button, input, a {
          cursor: pointer;
        }
        
        /* Hide default cursor when custom cursor is mounted */
        body.custom-cursor {
          cursor: none;
        }
        
        body.custom-cursor button,
        body.custom-cursor input,
        body.custom-cursor a {
          cursor: none;
        }
      `}</style>

      {/* Script to add custom cursor class when mounted */}
      {isMounted && (
        <script
          dangerouslySetInnerHTML={{
            __html: `document.body.classList.add('custom-cursor');`,
          }}
        />
      )}
    </div>
  );
}