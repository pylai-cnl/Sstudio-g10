import React from "react";
import { AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../utils/classNames";

interface ConfirmationModalProps {
  isOpen: boolean; 
  title: string; 
  message: string; 
  onConfirm: () => void; 
  onCancel: () => void;
  confirmText?: string;
  type?: "danger" | "primary";
  isAlert?: boolean;
}

export default function ConfirmationModal({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel,
  confirmText = "Confirm",
  type = "primary",
  isAlert = false
}: ConfirmationModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white w-full max-w-xs rounded-3xl p-6 shadow-2xl relative z-10 text-center"
          >
            <div className={cn(
              "w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center",
              type === "danger" ? "bg-red-50 text-red-500" : "bg-primary/10 text-primary"
            )}>
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2">{title}</h3>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">{message}</p>
            <div className="flex flex-col gap-2">
              <button 
                onClick={onConfirm}
                className={cn(
                  "w-full py-3 rounded-xl font-bold transition-all",
                  type === "danger" ? "bg-red-500 text-white hover:bg-red-600" : "bg-primary text-white hover:bg-primary-hover"
                )}
              >
                {confirmText}
              </button>
              {!isAlert && (
                <button 
                  onClick={onCancel}
                  className="w-full py-3 rounded-xl font-bold text-gray-400 hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}