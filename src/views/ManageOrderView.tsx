import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { ChevronLeft, Info, Camera, CheckCircle, Truck, Package } from "lucide-react";
import { User as FirebaseUser } from "firebase/auth";
import { doc, updateDoc, runTransaction } from "firebase/firestore";
import { db } from "../firebase";
import { Product, UserProfile, ChatRoom } from "../types";
import { cn } from "../utils/classNames";
import StatusBadge from "../components/StatusBadge";

export interface ManageOrdersViewProps {
  key?: string;
  products: Product[];
  users: Record<string, UserProfile>;
  chatRooms: ChatRoom[];
  currentUser: FirebaseUser | null;
  onBack: () => void;
  onSelectProduct: (p: Product) => void;
  showAlert: (title: string, message: string) => void;
  onSendSystemMessage: (productId: string, sellerId: string, buyerId: string, text: string) => Promise<void>;
  onViewSellerShop: (sellerId: string) => void;
}

export default function ManageOrdersView({ 
  products, 
  users,
  chatRooms, 
  currentUser, 
  onBack, 
  onSelectProduct, 
  showAlert, 
  onSendSystemMessage,
  onViewSellerShop 
}: ManageOrdersViewProps) {
  const [tab, setTab] = useState<"purchases" | "sales">("purchases");
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const myPurchases = products.filter(p => p.buyerId === currentUser?.uid);
  const mySales = products.filter(p => p.sellerId === currentUser?.uid && p.status !== "Still on");

  useEffect(() => {
    const unnotifiedSales = mySales.filter(p => p.sellerNotified === false);
    if (unnotifiedSales.length > 0) {
      unnotifiedSales.forEach(p => {
        updateDoc(doc(db, "products", p.id), { sellerNotified: true });
      });
    }
  }, [mySales.length]);

  const handleStatusUpdate = async (product: Product, newStatus: Product["status"]) => {
    try {
      if (!currentUser) throw new Error("You must be logged in.");

      await runTransaction(db, async (transaction) => {
        const productRef = doc(db, "products", product.id);
        const productSnap = await transaction.get(productRef);

        if (!productSnap.exists()) {
          throw new Error("Product not found.");
        }

        const latest = { id: product.id, ...productSnap.data() } as Product;
        const updates: Partial<Product> = {};

        if (newStatus === "Delivered") {
          if (latest.status !== "Pending" || latest.sellerId !== currentUser.uid) {
            throw new Error("Only the seller can mark a pending order as delivered.");
          }
          updates.status = "Delivered";
          updates.deliveredAt = new Date().toISOString();
        } else if (newStatus === "Completed") {
          if (latest.status !== "Delivered" || latest.buyerId !== currentUser.uid) {
            throw new Error("Only the buyer can complete a delivered order.");
          }
          updates.status = "Completed";
          updates.completedAt = new Date().toISOString();
        } else if (newStatus === "Still on") {
          if (!["Pending", "Delivered"].includes(latest.status) || latest.sellerId !== currentUser.uid) {
            throw new Error("Only the seller can cancel this transaction.");
          }
          updates.status = "Still on";
          updates.buyerId = "";
          updates.buyerName = "";
          updates.deliveredAt = "";
          updates.completedAt = "";
        } else {
          throw new Error("Unsupported status transition.");
        }

        transaction.update(productRef, updates as any);
      });

      if (newStatus === "Delivered" && product.buyerId) {
        await onSendSystemMessage(
          product.id,
          product.sellerId,
          product.buyerId,
          `The seller has delivered your item "${product.title}". Please check it.`
        );
      }

      showAlert("Success", `Order status updated to ${newStatus}`);
    } catch (error: any) {
      console.error("Update failed:", error);
      showAlert("Error", error?.message || "Failed to update order status.");
    }
  };

  const handleAssignBuyer = async (productId: string, buyerId: string, buyerName: string, sellerId: string) => {
    try {
      await updateDoc(doc(db, "products", productId), { 
        buyerId, 
        buyerName,
        status: "Completed"
      });

      setAssigningId(null);
      showAlert("Success", "Buyer assigned successfully. They can now see this in their purchases.");
    } catch (error) {
      showAlert("Error", "Failed to assign buyer.");
    }
  };

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
        <h2 className="text-xl font-black text-gray-900">Manage Orders</h2>
      </div>

      <div className="flex border-b border-gray-100">
        <button 
          onClick={() => setTab("purchases")}
          className={cn(
            "flex-1 py-4 text-sm font-bold transition-all relative",
            tab === "purchases" ? "text-primary" : "text-gray-400"
          )}
        >
          My Purchases
          {tab === "purchases" && <motion.div layoutId="orderTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
        </button>
        <button 
          onClick={() => setTab("sales")}
          className={cn(
            "flex-1 py-4 text-sm font-bold transition-all relative",
            tab === "sales" ? "text-primary" : "text-gray-400"
          )}
        >
          My Sales
          {tab === "sales" && <motion.div layoutId="orderTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tab === "purchases" && myPurchases.length === 0 && (
          <div className="bg-blue-50 p-4 rounded-2xl mb-4">
            <p className="text-xs text-blue-600 leading-relaxed">
              <Info className="w-3 h-3 inline mr-1" />
              Note: Orders placed before the system update may not appear here. Please contact the seller to "Assign" the order to you.
            </p>
          </div>
        )}

        {(tab === "purchases" ? myPurchases : mySales).length > 0 ? (
          (tab === "purchases" ? myPurchases : mySales).map(product => (
            <div key={product.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <div className="flex gap-4 mb-4 cursor-pointer" onClick={() => onSelectProduct(product)}>
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                  {product.images?.[0] ? (
                    <img src={product.images[0]} className="w-full h-full object-cover" alt={product.title} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <Camera className="w-6 h-6" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 line-clamp-1">{product.title}</h3>
                  <p className="text-primary font-black text-lg">${product.price}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusBadge status={product.status} />
                  </div>
                  {tab === "purchases" ? (
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewSellerShop(product.sellerId);
                      }}
                      className="flex items-center gap-2 mt-2 cursor-pointer group"
                    >
                      <div className="w-5 h-5 rounded-full overflow-hidden border border-gray-100">
                        <img 
                          src={users[product.sellerId]?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${product.sellerId}`} 
                          className="w-full h-full object-cover" 
                          alt="seller" 
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 group-hover:text-primary transition-colors">Seller: {product.sellerName}</p>
                    </div>
                  ) : product.buyerId ? (
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewSellerShop(product.buyerId!);
                      }}
                      className="flex items-center gap-2 mt-2 cursor-pointer group"
                    >
                      <div className="w-5 h-5 rounded-full overflow-hidden border border-gray-100">
                        <img 
                          src={users[product.buyerId]?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${product.buyerId}`} 
                          className="w-full h-full object-cover" 
                          alt="buyer" 
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 group-hover:text-primary transition-colors">Buyer: {product.buyerName}</p>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {tab === "purchases" && (
                  <>
                    {product.status === "Delivered" && (
                      <button 
                        onClick={() => handleStatusUpdate(product, "Completed")}
                        className="w-full btn-primary py-2 text-xs flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Confirm Received
                      </button>
                    )}
                    {product.status === "Pending" && (
                      <p className="text-xs text-gray-400 italic py-2">Waiting for seller to deliver...</p>
                    )}
                    {(product.status === "Completed" || product.status === "Sold") && (
                      <p className="text-xs text-green-500 font-bold py-2 flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" /> Order Completed
                      </p>
                    )}
                  </>
                )}

                {tab === "sales" && (
                  <>
                    {product.status === "Pending" && (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleStatusUpdate(product, "Delivered")}
                          className="flex-1 btn-primary py-2 text-xs flex items-center justify-center gap-2"
                        >
                          <Truck className="w-4 h-4" />
                          Mark Delivered
                        </button>
                        <button 
                          onClick={() => handleStatusUpdate(product, "Still on")}
                          className="px-4 py-2 border border-red-100 text-red-500 rounded-xl text-xs hover:bg-red-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                    {product.status === "Delivered" && (
                      <p className="text-xs text-gray-400 italic py-2">Waiting for buyer to confirm...</p>
                    )}
                    {(product.status === "Completed" || product.status === "Sold") && !product.buyerId && (
                      <div className="space-y-2 pt-2 border-t border-gray-50">
                        <p className="text-[10px] text-orange-500 font-bold uppercase">Legacy Order: No Buyer Assigned</p>
                        {assigningId === product.id ? (
                          <div className="space-y-2">
                            <p className="text-[10px] text-gray-400">Select the buyer from your chats:</p>
                            <div className="flex flex-wrap gap-2">
                              {chatRooms
                                .filter(room => room.productId === product.id)
                                .map(room => {
                                  const otherParticipantId = room.participants.find(id => id !== currentUser?.uid);
                                  return (
                                    <button
                                      key={room.id}
                                      onClick={() => handleAssignBuyer(product.id, otherParticipantId!, "Chat Participant", product.sellerId)}
                                      className="px-3 py-1 bg-gray-100 hover:bg-primary hover:text-white rounded-full text-[10px] font-bold transition-all"
                                    >
                                      Assign to Chat Partner
                                    </button>
                                  );
                                })}
                              <button onClick={() => setAssigningId(null)} className="text-[10px] text-gray-400 underline">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setAssigningId(product.id)}
                            className="w-full py-2 bg-orange-50 text-orange-600 rounded-xl text-xs font-bold hover:bg-orange-100 transition-colors"
                          >
                            Assign Buyer to show in their list
                          </button>
                        )}
                      </div>
                    )}
                    {(product.status === "Completed" || product.status === "Sold") && product.buyerId && (
                      <p className="text-xs text-green-500 font-bold py-2 flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" /> Sale Completed
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 py-12">
            <Package className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm">No orders found in this category.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}