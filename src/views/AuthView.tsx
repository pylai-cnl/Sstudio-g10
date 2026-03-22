import React, { useState } from "react";
import { motion } from "motion/react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";

export interface AuthViewProps {
  onLogin: () => void;
}

export default function AuthView({ onLogin }: AuthViewProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      if (err.code === "auth/operation-not-allowed") {
        setError("Email/Password login is not enabled in Firebase Console. Please enable it in Authentication > Sign-in method.");
      } else if (err.code === "auth/email-already-in-use") {
        setError("This email is already registered. Please login instead.");
      } else if (err.code === "auth/weak-password") {
        setError("Password should be at least 6 characters.");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-white px-8 text-center overflow-y-auto py-10">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-primary text-6xl font-black tracking-tighter mb-2">Relo</h1>
        <p className="text-gray-500 font-medium">Cornell Tech Campus Marketplace</p>
      </motion.div>
      
      <div className="w-full max-w-xs space-y-4">
        <form onSubmit={handleEmailAuth} className="space-y-3">
          <div className="text-left">
            <label className="text-[10px] font-bold text-gray-400 uppercase px-2 mb-1 block">University Email</label>
            <input 
              type="email" 
              placeholder="name@cornell.edu" 
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <p className="text-[9px] text-gray-400 px-2 mt-1 italic">Use .edu or .ca for student verification</p>
          </div>
          <div className="text-left">
            <label className="text-[10px] font-bold text-gray-400 uppercase px-2 mb-1 block">Password</label>
            <input 
              type="password" 
              placeholder="Min. 6 characters" 
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-red-500 text-xs text-left px-2">{error}</p>}
          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary/20 hover:bg-primary-hover transition-all disabled:opacity-50"
          >
            {loading ? "Processing..." : (isSignUp ? "Sign Up" : "Login")}
          </button>
        </form>

        <div className="flex items-center gap-2 py-2">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-gray-400 text-xs font-bold uppercase">OR</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        <button 
          onClick={onLogin}
          className="w-full bg-white text-gray-700 border border-gray-200 font-bold py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-gray-50 transition-all"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5 bg-white rounded-full p-0.5" alt="Google" />
          Continue with Google
        </button>

        <button 
          onClick={() => setIsSignUp(!isSignUp)}
          className="text-primary font-bold text-sm hover:underline"
        >
          {isSignUp ? "Already have an account? Login" : "Don't have an account? Sign Up"}
        </button>

        <p className="text-xs text-gray-400 px-6 pt-4">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}