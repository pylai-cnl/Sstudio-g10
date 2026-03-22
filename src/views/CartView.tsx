import React from "react";
import { motion } from "motion/react";
import { ChevronLeft, ShoppingCart, Trash2 } from "lucide-react";
import { Product } from "../types";

export interface CartViewProps {
  key?: string;
  products: Product[];
  onSelectProduct: (p: Product) => void;
  onRemoveFromCart: (id: string) => void;
  onCheckout: () => void;
  onBack: () => void;
}

export default function CartView({ 
  products, 
  onSelectProduct, 
  onRemoveFromCart, 
  onCheckout, 
  onBack 
}: CartViewProps) {
  const total = products.reduce((sum, p) => sum + p.price, 0);

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
          products.map(product => (
            <div 
              key={product.id}
              className="flex gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 group"
            >
              <div 
                className="w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 cursor-pointer"
                onClick={() => onSelectProduct(product)}
              >
                <img src={product.images?.[0] || "https://picsum.photos/seed/item/200"} className="w-full h-full object-cover" alt={product.title} />
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <h4 
                      className="font-bold text-gray-900 truncate cursor-pointer hover:text-primary transition-colors"
                      onClick={() => onSelectProduct(product)}
                    >
                      {product.title}
                    </h4>
                    <button 
                      onClick={() => onRemoveFromCart(product.id)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{product.category}</p>
                </div>
                <div className="flex justify-between items-end">
                  <span className="text-lg font-black text-primary">${product.price}</span>
                  {product.status !== "Still on" && (
                    <span className="text-[10px] font-bold text-red-500 uppercase bg-red-50 px-2 py-1 rounded">No longer available</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {products.length > 0 && (
        <div className="p-6 border-t border-gray-100 bg-white space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-500 font-bold">Total</span>
            <span className="text-2xl font-black text-gray-900">${total}</span>
          </div>
          <button 
            onClick={onCheckout}
            className="w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            Checkout Now
          </button>
        </div>
      )}
    </motion.div>
  );
}