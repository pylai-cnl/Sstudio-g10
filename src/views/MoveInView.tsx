import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ShoppingCart, Search, PackageOpen, Plus, LayoutGrid, Check, Sparkles } from "lucide-react";
import { Product } from "../types";
import { cn } from "../utils/classNames";

export interface MoveInViewProps {
  key?: string;
  products: Product[];
  onAddToCart: (product: Product) => void;
  onProductClick: (product: Product) => void;
  cartItems: string[];
}

const MOVE_IN_CATEGORIES = [
  "Furniture", 
  "Electronics", 
  "Appliances", 
  "Kitchen & Dining", 
  "Bed & Bath", 
  "Storage", 
  "Decor",
  "Textbooks",
  "Other"
];

export default function MoveInView({ products, onAddToCart, onProductClick, cartItems }: MoveInViewProps) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category) 
        : [...prev, category]
    );
  };

  const recommendedListings = useMemo(() => {
    if (selectedCategories.length === 0) return [];
    return products.filter(product => {
      if (product.status !== "Still on") return false;
      return selectedCategories.some(cat => 
        product.category?.toLowerCase() === cat.toLowerCase() || 
        product.category?.toLowerCase().includes(cat.toLowerCase())
      );
    });
  }, [selectedCategories, products]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-4xl mx-auto px-4 py-8 pb-32"
    >
      <div className="bg-orange-50 border border-orange-100/50 rounded-[40px] p-8 md:p-12 shadow-sm relative overflow-hidden mb-12">
        <div className="absolute right-0 top-0 opacity-[0.03] rotate-12 translate-x-6 -translate-y-6">
          <PackageOpen className="w-72 h-72 text-orange-900" />
        </div>
        
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-2 mb-4 bg-orange-100/80 w-fit px-3 py-1 rounded-full border border-orange-200/50">
            <Sparkles className="w-4 h-4 text-orange-600" />
            <span className="text-[10px] font-black uppercase tracking-wider text-orange-800">Bundle Discovery</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tighter text-gray-900">Smart Move-In</h1>
          <p className="text-gray-600 text-sm md:text-base mb-10 leading-relaxed font-medium">
            Select the categories you need for your new dorm or apartment. We'll instantly find the best local deals to help you settle in.
          </p>

          <div className="flex items-center gap-2 mb-4">
            <LayoutGrid className="w-4 h-4 text-orange-400" />
            <h3 className="font-bold text-xs uppercase tracking-widest text-orange-900/60">Filter Essentials</h3>
          </div>

          <div className="flex flex-wrap gap-3">
            {MOVE_IN_CATEGORIES.map(category => {
              const isSelected = selectedCategories.includes(category);
              return (
                <button
                  key={category}
                  onClick={() => toggleCategory(category)}
                  className={cn(
                    "px-5 py-3 rounded-2xl text-sm font-bold transition-all flex items-center gap-2 shadow-sm border",
                    isSelected 
                      ? "bg-orange-500 border-orange-500 text-white scale-105 shadow-md shadow-orange-500/20" 
                      : "bg-white border-orange-100 text-gray-600 hover:bg-orange-100/50 hover:text-orange-600"
                  )}
                >
                  {isSelected && <Check className="w-4 h-4 stroke-[3px]" />}
                  {category}
                </button>
              );
            })}
          </div>

          <AnimatePresence>
            {selectedCategories.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-8"
              >
                <button 
                  onClick={() => setSelectedCategories([])}
                  className="text-xs font-black text-gray-400 hover:text-orange-600 transition-colors flex items-center gap-1 group"
                >
                  <span className="border-b border-gray-300 group-hover:border-orange-400">Clear all selections</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="space-y-8 px-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">
              {selectedCategories.length === 0 ? "Popular Essentials" : "Your Move-In Package"}
            </h2>
            <p className="text-gray-400 text-xs font-medium mt-1">
              {selectedCategories.length === 0 
                ? "Items most students get first" 
                : `Showing available listings in ${selectedCategories.join(", ")}`}
            </p>
          </div>
          {recommendedListings.length > 0 && (
            <div className="bg-orange-50 text-orange-600 px-4 py-2 rounded-2xl text-xs font-black border border-orange-100">
              {recommendedListings.length} DEALS FOUND
            </div>
          )}
        </div>

        {selectedCategories.length > 0 && recommendedListings.length === 0 ? (
          <div className="text-center py-24 bg-gray-50 rounded-[40px] border-2 border-dashed border-gray-200">
            <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="font-black text-gray-900 mb-2">No matching items yet</h3>
            <p className="text-sm text-gray-500 max-w-xs mx-auto font-medium">
              We couldn't find any available listings for these categories. Try broadening your selection!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {(selectedCategories.length === 0 ? products.filter(p => p.status === "Still on").slice(0, 8) : recommendedListings).map(product => {
              const inCart = cartItems.includes(product.id);
              return (
                <div key={product.id} className="bg-white rounded-[32px] p-4 border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-orange-500/5 transition-all group flex flex-col">
                  {/* 【核心修复】：剥夺图片主动撑破布局的能力，强行锁定比例 */}
                  <div 
                    className="w-full relative pt-[100%] rounded-[24px] overflow-hidden bg-gray-50 mb-4 cursor-pointer"
                    onClick={() => onProductClick(product)}
                  >
                    <img 
                      src={product.images[0]} 
                      alt={product.title} 
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                    />
                    <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] font-black text-gray-900 shadow-sm z-10">
                      {product.condition}
                    </div>
                  </div>
                  
                  <div className="flex flex-col flex-1 px-1">
                    <h3 
                      className="text-sm font-black text-gray-900 truncate mb-1 cursor-pointer hover:text-orange-500 transition-colors"
                      onClick={() => onProductClick(product)}
                    >
                      {product.title}
                    </h3>
                    <p className="text-[11px] text-gray-400 font-bold flex items-center gap-1 mb-4">
                      <LayoutGrid className="w-3 h-3" /> {product.category}
                    </p>
                    
                    <div className="mt-auto flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest leading-none">Price</p>
                        <span className="text-xl font-black text-orange-500 tracking-tighter">${product.price}</span>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!inCart) onAddToCart(product);
                        }}
                        disabled={inCart}
                        className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-md",
                          inCart 
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed" 
                            : "bg-gray-900 text-white hover:bg-orange-500 hover:scale-105 active:scale-95"
                        )}
                      >
                        {inCart ? <Check className="w-5 h-5 stroke-[3px]" /> : <Plus className="w-6 h-6 stroke-[3px]" />}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}