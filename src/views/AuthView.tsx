import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Package, ArrowRight, Mail, Lock, UserPlus, LogIn } from "lucide-react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";

export interface AuthViewProps {
  onLogin: () => void; // 触发 Google 登录
}

export default function AuthView({ onLogin }: AuthViewProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 处理传统的邮箱/密码注册与登录
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignUp) {
        // 注册新账号
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        // 登录现有账号 (Admin 也可以直接从这里登录)
        await signInWithEmailAndPassword(auth, email, password);
      }
      // 注意：一旦 Firebase Auth 状态改变，外层 App.tsx 会自动监听到并进入系统，这里无需手动跳转
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError("This email is already registered. Please log in.");
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setError("Invalid email or password.");
      } else if (err.code === 'auth/weak-password') {
        setError("Password should be at least 6 characters.");
      } else {
        setError("Authentication failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* 极简的高级背景装饰 */}
      <div className="absolute top-0 left-0 w-full h-96 bg-primary/10 -skew-y-6 transform origin-top-left -translate-y-20 z-0" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-orange-400/10 rounded-full blur-3xl z-0 translate-x-20 translate-y-20" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[400px] relative z-10"
      >
        <div className="bg-white rounded-[40px] shadow-2xl p-8 md:p-10 border border-gray-100 overflow-hidden">
          
          {/* Logo 与标语 */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 bg-orange-50 text-primary rounded-[24px] flex items-center justify-center mb-6 rotate-3 shadow-sm border border-orange-100">
              <Package className="w-10 h-10 -rotate-3" />
            </div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tighter mb-2">Relo</h1>
            <p className="text-gray-500 font-medium text-center text-sm">
              The smartest way to move in and out of your campus.
            </p>
          </div>

          {/* Google 一键登录按钮 */}
          <button 
            type="button"
            onClick={onLogin}
            className="w-full bg-white border border-gray-200 text-gray-700 rounded-2xl py-3.5 font-bold text-sm flex items-center justify-center gap-3 hover:bg-gray-50 active:scale-95 transition-all shadow-sm mb-6"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 15.02 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>

          {/* 分割线 */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Or email</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {/* 邮箱密码登录/注册表单 */}
          <AnimatePresence mode="wait">
            <motion.form 
              key={isSignUp ? "signup" : "login"}
              initial={{ opacity: 0, x: isSignUp ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isSignUp ? -20 : 20 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleEmailAuth}
              className="space-y-4"
            >
              {error && (
                <div className="bg-red-50 text-red-500 text-xs font-bold p-3 rounded-xl text-center border border-red-100">
                  {error}
                </div>
              )}

              <div className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input 
                    type="email" 
                    required
                    placeholder="Email Address" 
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3.5 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-orange-500/20 focus:outline-none transition-all"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input 
                    type="password" 
                    required
                    placeholder="Password" 
                    minLength={6}
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3.5 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-orange-500/20 focus:outline-none transition-all"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-white rounded-xl py-3.5 font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary-hover active:scale-95 transition-all disabled:opacity-50 mt-2 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : isSignUp ? (
                  <>
                    <UserPlus className="w-4 h-4" /> Sign Up
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" /> Log In
                  </>
                )}
              </button>
            </motion.form>
          </AnimatePresence>
        </div>

        {/* 底部切换按钮：注册 vs 登录 */}
        <div className="mt-8 text-center">
          <button 
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError("");
              setPassword("");
            }}
            className="text-sm font-medium text-gray-500 hover:text-primary transition-colors"
          >
            {isSignUp ? (
              <>Already have an account? <span className="font-bold underline">Log in</span></>
            ) : (
              <>Don't have an account? <span className="font-bold underline">Sign up</span></>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}