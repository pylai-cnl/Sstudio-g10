import React from "react";
import { motion } from "motion/react";
import { ChevronLeft, ShoppingCart, Trash2, ShieldCheck, Truck } from "lucide-react";
import { Product, UserProfile } from "../types";
import { cn } from "../utils/classNames";

export interface CartViewProps {
  key?: string;
  products: Product[];
  users: Record<string, UserProfile>; // 【核心】：传入 users 以便识别官方账号
  onSelectProduct: (p: Product) => void;
  onRemoveFromCart: (id: string) => void;
  onCheckout: () => void;
  onBack: () => void;
}

export default function CartView({ 
  products, 
  users,
  onSelectProduct, 
  onRemoveFromCart, 
  onCheckout, 
  onBack 
}: CartViewProps) {
  const total = products.reduce((sum, p) => sum + p.price, 0);
  
  // 【判断逻辑】：检查购物车里是否包含 relo 官方发布的商品
  const hasOfficialItems = products.some(p => users[p.sellerId]?.isAdmin);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full bg-white"
    >
      <div className="p-4 border-b border-gray-100 flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-black text-gray-900">Shopping Cart</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center text-gray-300 mb-4">
              <ShoppingCart className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Your cart is empty</h3>
            <p className="text-gray-500 text-sm max-w-[200px] mx-auto mt-2">
              Looks like you haven't added any items to your cart yet.
            </p>
            <button 
              onClick={onBack}
              className="mt-6 text-primary font-bold hover:underline"
            >
              Go Shopping
            </button>
          </div>
        ) : (
          products.map(product => {
            const isOfficial = users[product.sellerId]?.isAdmin;

            return (
              <div 
                key={product.id}
                className="flex gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 group relative"
              >
                <div 
                  className="w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 cursor-pointer border border-black/5"
                  onClick={() => onSelectProduct(product)}
                >
                  <img 
                    src={product.images?.[0] || "https://picsum.photos/seed/item/200"} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    alt={product.title} 
                  />
                </div>
                
                <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                  <div>
                    <div className="flex justify-between items-start gap-2">
                      <h4 
                        className="font-bold text-gray-900 truncate cursor-pointer hover:text-primary transition-colors flex flex-col sm:flex-row sm:items-center gap-1.5"
                        onClick={() => onSelectProduct(product)}
                      >
                        <span className="truncate">{product.title}</span>
                        {/* 【商品级标识】：如果是官方商品，名字旁边会显示金标 */}
                        {isOfficial && (
                          <span className="bg-orange-500 text-white px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest flex items-center gap-0.5 w-fit shadow-sm">
                            <ShieldCheck className="w-2.5 h-2.5" /> Official
                          </span>
                        )}
                      </h4>
                      <button 
                        onClick={() => onRemoveFromCart(product.id)}
                        className="p-1.5 -m-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{product.category}</p>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="text-lg font-black text-primary">${product.price}</span>
                    {product.status !== "Still on" && (
                      <span className="text-[10px] font-bold text-red-500 uppercase bg-red-50 px-2 py-1 rounded border border-red-100">
                        No longer available
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {products.length > 0 && (
        <div className="p-6 border-t border-gray-100 bg-white space-y-5 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
          
          {/* 【大招：官方提前送货服务促单横幅】 */}
          {hasOfficialItems && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm"
            >
              <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-black text-green-800 uppercase tracking-wide">Free Early Delivery Unlocked! 🎉</p>
                <p className="text-[10px] text-green-700 mt-1 leading-relaxed font-medium">
                  Your cart contains Relo Official items. Checkout now, and our concierge team will contact you to arrange placement in your room before you arrive!
                </p>
              </div>
            </motion.div>
          )}

          <div className="flex justify-between items-center">
            <span className="text-gray-500 font-bold uppercase tracking-widest text-xs">Total</span>
            <span className="text-3xl font-black text-gray-900">${total}</span>
          </div>
          
          <button 
            onClick={onCheckout}
            className="w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            Checkout Now
          </button>
        </div>
      )}
    </motion.div>
  );
}