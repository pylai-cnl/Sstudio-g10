import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Package, ArrowRight, ShieldCheck, Mail, Lock } from "lucide-react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";

export interface AuthViewProps {
  onLogin: () => void;
}

export default function AuthView({ onLogin }: AuthViewProps) {
  const [showAdminPortal, setShowAdminPortal] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 处理管理员的账号密码登录
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 成功登录后，App.tsx 里的 onAuthStateChanged 会自动接管，不需要额外传参
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error(err);
      setError("Invalid admin credentials.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-full h-96 bg-primary/10 -skew-y-6 transform origin-top-left -translate-y-20 z-0" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-orange-400/10 rounded-full blur-3xl z-0 translate-x-20 translate-y-20" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[400px] relative z-10"
      >
        <div className="bg-white rounded-[40px] shadow-2xl p-8 md:p-10 border border-gray-100 overflow-hidden">
          
          {/* Logo & Brand */}
          <div className="flex flex-col items-center mb-10">
            <div className="w-20 h-20 bg-orange-50 text-primary rounded-[24px] flex items-center justify-center mb-6 rotate-3 shadow-sm border border-orange-100">
              <Package className="w-10 h-10 -rotate-3" />
            </div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tighter mb-2">Relo</h1>
            <p className="text-gray-500 font-medium text-center text-sm">
              The smartest way to move in and out of your campus.
            </p>
          </div>

          <AnimatePresence mode="wait">
            {!showAdminPortal ? (
              <motion.div 
                key="student-login"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                {/* 正常的学生 Google 登录 */}
                <button 
                  onClick={onLogin}
                  className="w-full bg-primary text-white rounded-2xl py-4 font-bold text-lg flex items-center justify-center gap-3 shadow-lg shadow-primary/20 hover:bg-primary-hover active:scale-95 transition-all group"
                >
                  Continue with Google
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>

                <div className="bg-gray-50 p-4 rounded-2xl text-center border border-gray-100">
                  <p className="text-xs text-gray-500 font-medium">
                    Use your <span className="font-bold text-gray-700">.edu</span> email to automatically get verified student status.
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.form 
                key="admin-login"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleAdminLogin}
                className="space-y-4"
              >
                <div className="flex items-center justify-center gap-2 mb-6">
                  <ShieldCheck className="w-5 h-5 text-orange-500" />
                  <h3 className="font-black text-gray-900 uppercase tracking-widest">Admin Portal</h3>
                </div>

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
                      placeholder="Admin Email" 
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
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3.5 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-orange-500/20 focus:outline-none transition-all"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gray-900 text-white rounded-xl py-3.5 font-bold text-sm shadow-lg hover:bg-black active:scale-95 transition-all disabled:opacity-50 mt-2"
                >
                  {loading ? "Verifying..." : "Log In as Admin"}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        {/* 底部切换按钮 */}
        <div className="mt-8 text-center">
          <button 
            onClick={() => {
              setShowAdminPortal(!showAdminPortal);
              setError("");
            }}
            className="text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-widest"
          >
            {showAdminPortal ? "← Back to Student Login" : "Staff / Admin Portal"}
          </button>
        </div>

      </motion.div>
    </div>
  );
}