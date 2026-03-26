import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Camera, Trash2, ChevronLeft, Store, ShieldCheck, MapPin, 
  Calendar, Truck, Plus, Clock, DollarSign, AlertCircle, 
  CheckCircle, Recycle, XCircle
} from "lucide-react";
import { collection, addDoc, query, where, onSnapshot, updateDoc, doc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import { UserProfile } from "../types";
import { cn } from "../utils/classNames";

export interface PlatformBuyViewProps {
  key?: string;
  onSuccess: () => void;
  onBack: () => void;
  profile: UserProfile | null;
  showAlert: (title: string, message: string) => void;
}

// 局部定义回收请求的数据结构，避免去修改全局的 types.ts 产生冲突
interface AcquisitionRequest {
  id: string;
  itemName: string;
  originalPrice: number;
  condition: string;
  moveOutDate: string;
  address: string;
  logisticsNote: string;
  description: string;
  images: string[];
  sellerId: string;
  status: "Pending Evaluation" | "Offer Made" | "Rejected" | "Accepted" | "Declined" | "Free Recycle";
  offerPrice?: number;
  createdAt: string;
}

export default function PlatformBuyView({ onSuccess, onBack, profile, showAlert }: PlatformBuyViewProps) {
  // 控制当前是显示“列表看板”还是“填写表单”
  const [viewMode, setViewMode] = useState<"dashboard" | "form">("dashboard");
  const [requests, setRequests] = useState<AcquisitionRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // 监听当前用户的所有回收请求
  useEffect(() => {
    if (!profile) return;
    
    const q = query(
      collection(db, "platform_acquisitions"),
      where("sellerId", "==", profile.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AcquisitionRequest[];
      
      // 按时间倒序排列
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRequests(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching requests:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, [profile]);

  // 更新请求状态的通用函数
  const handleUpdateStatus = async (id: string, newStatus: AcquisitionRequest["status"]) => {
    try {
      await updateDoc(doc(db, "platform_acquisitions", id), {
        status: newStatus
      });
      showAlert("Success", `Request updated to: ${newStatus}`);
    } catch (error: any) {
      console.error("Update failed:", error);
      if (error.message.includes("permission")) {
        showAlert("Permission Denied", "Please ensure Firestore Rules allow users to update their own requests.");
      } else {
        showAlert("Error", "Failed to update status.");
      }
    }
  };

  // --- 渲染子组件：回收请求卡片 ---
  const renderRequestCard = (req: AcquisitionRequest) => {
    return (
      <div key={req.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm mb-4">
        <div className="flex gap-4 mb-4">
          <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 border border-black/5">
            <img src={req.images[0]} className="w-full h-full object-cover" alt={req.itemName} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 truncate">{req.itemName}</h3>
            <p className="text-xs text-gray-400 mt-1">Purchased for ${req.originalPrice}</p>
            <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wider">{new Date(req.createdAt).toLocaleDateString()}</p>
            
            {/* 动态状态徽章 */}
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
              {req.status === "Pending Evaluation" && <span className="bg-yellow-100 text-yellow-700 flex items-center gap-1 px-2 py-0.5 rounded-full"><Clock className="w-3 h-3" /> Evaluating</span>}
              {req.status === "Offer Made" && <span className="bg-green-100 text-green-700 flex items-center gap-1 px-2 py-0.5 rounded-full"><DollarSign className="w-3 h-3" /> Action Required</span>}
              {req.status === "Rejected" && <span className="bg-red-100 text-red-600 flex items-center gap-1 px-2 py-0.5 rounded-full"><AlertCircle className="w-3 h-3" /> Rejected</span>}
              {req.status === "Accepted" && <span className="bg-blue-100 text-blue-600 flex items-center gap-1 px-2 py-0.5 rounded-full"><CheckCircle className="w-3 h-3" /> Scheduled</span>}
              {req.status === "Free Recycle" && <span className="bg-teal-100 text-teal-700 flex items-center gap-1 px-2 py-0.5 rounded-full"><Recycle className="w-3 h-3" /> Free Recycle</span>}
              {req.status === "Declined" && <span className="bg-gray-100 text-gray-500 flex items-center gap-1 px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3" /> Closed</span>}
            </div>
          </div>
        </div>

        {/* 动态操作区域 */}
        <div className="bg-gray-50 rounded-xl p-3">
          {req.status === "Pending Evaluation" && (
            <p className="text-xs text-gray-500 text-center italic">Our team is reviewing your item. Please check back within 24 hours.</p>
          )}

          {req.status === "Offer Made" && (
            <div className="space-y-3">
              <div className="text-center">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Relo Offer</p>
                <p className="text-3xl font-black text-green-500">${req.offerPrice}</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleUpdateStatus(req.id, "Accepted")}
                  className="flex-1 bg-black text-white py-2.5 rounded-xl text-xs font-bold hover:bg-gray-800 transition-all shadow-md"
                >
                  Accept Offer
                </button>
                <button 
                  onClick={() => handleUpdateStatus(req.id, "Declined")}
                  className="flex-1 bg-white border border-gray-200 text-gray-600 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all"
                >
                  Decline
                </button>
              </div>
            </div>
          )}

          {req.status === "Rejected" && (
            <div className="space-y-3">
              <p className="text-xs text-red-500 text-center font-medium">
                Unfortunately, this item does not meet our buyout criteria. However, we can help you dispose of it.
              </p>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleUpdateStatus(req.id, "Free Recycle")}
                  className="flex-1 bg-teal-500 text-white py-2.5 rounded-xl text-xs font-bold hover:bg-teal-600 transition-all shadow-md flex items-center justify-center gap-1.5"
                >
                  <Recycle className="w-4 h-4" /> Recycle for Free
                </button>
                <button 
                  onClick={() => handleUpdateStatus(req.id, "Declined")}
                  className="flex-1 bg-white border border-gray-200 text-gray-600 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all"
                >
                  I'll handle it
                </button>
              </div>
            </div>
          )}

          {req.status === "Accepted" && (
            <p className="text-xs text-blue-600 text-center font-bold">Great! Our logistics team will email you to confirm the pickup time.</p>
          )}

          {req.status === "Free Recycle" && (
            <p className="text-xs text-teal-600 text-center font-bold">Free recycling scheduled. We will email you the pickup details.</p>
          )}

          {req.status === "Declined" && (
            <p className="text-xs text-gray-400 text-center italic">This request has been closed.</p>
          )}
        </div>
      </div>
    );
  };

  // --- 表单部分代码提取 ---
  const [formData, setFormData] = useState({
    itemName: "", originalPrice: "", condition: "Used - Good", moveOutDate: "", address: "", logisticsNote: "Elevator available", description: "",
  });
  const [images, setImages] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) setFormData(prev => ({ ...prev, moveOutDate: prev.moveOutDate || profile.departureDate || "", address: prev.address || profile.dormLocation || "" }));
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return showAlert("System Error", "User profile not loaded.");
    if (images.length === 0) return showAlert("Missing Photos", "Please upload photos showing the current condition.");

    setUploading(true);
    try {
      const imageUrls = await Promise.all(
        images.map(async (file) => {
          const storageRef = ref(storage, `platform_buys/${profile.uid}_${Date.now()}_${file.name}`);
          await uploadBytes(storageRef, file);
          return await getDownloadURL(storageRef);
        })
      );

      const originalPriceNum = parseFloat(formData.originalPrice);
      if (isNaN(originalPriceNum)) { setUploading(false); return showAlert("Invalid Price", "Valid number required."); }

      const acquisitionPayload = {
        itemName: formData.itemName || "",
        originalPrice: originalPriceNum,
        condition: formData.condition || "Used - Good",
        moveOutDate: formData.moveOutDate || "",
        address: formData.address || "",
        logisticsNote: formData.logisticsNote || "",
        description: formData.description || "",
        images: imageUrls,
        sellerId: profile.uid,
        sellerEmail: profile.email || "",
        sellerName: profile.displayName || "Anonymous",
        status: "Pending Evaluation",
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, "platform_acquisitions"), acquisitionPayload);
      
      showAlert("Request Submitted!", "Our team will evaluate your item and send an offer soon.");
      
      // 提交成功后清空表单并切回看板视图
      setImages([]);
      setFormData(prev => ({ ...prev, itemName: "", originalPrice: "", description: "" }));
      setViewMode("dashboard");
    } catch (error: any) {
      console.error("Submission failed:", error);
      showAlert("Error", "Failed to submit request.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="p-6 max-w-2xl mx-auto pb-24"
    >
      <div className="flex items-center justify-between mb-8 sticky top-0 bg-gray-50/80 backdrop-blur-md py-4 z-10 -mx-6 px-6">
        <div className="flex items-center gap-4">
          <button onClick={() => viewMode === "form" ? setViewMode("dashboard") : onBack()} className="p-2 -ml-2 text-gray-600 hover:bg-white rounded-full transition-colors shadow-sm">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-xl font-black text-gray-900">Sell to Relo</h2>
            <p className="text-xs text-gray-500 font-medium">Official Buyout & Recycle</p>
          </div>
        </div>
        
        {viewMode === "dashboard" && (
          <button 
            onClick={() => setViewMode("form")}
            className="bg-primary text-white p-2 rounded-xl shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
          >
            <Plus className="w-6 h-6" />
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {viewMode === "dashboard" ? (
          <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {loading ? (
              <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
            ) : requests.length > 0 ? (
              <div className="space-y-4">
                {requests.map(renderRequestCard)}
              </div>
            ) : (
              <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                <div className="w-20 h-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <Store className="w-10 h-10" />
                </div>
                <h3 className="font-black text-gray-900 mb-2">No Requests Yet</h3>
                <p className="text-sm text-gray-500 max-w-xs mx-auto mb-6">Got bulky furniture you can't sell? Let us make you an offer or recycle it for free.</p>
                <button onClick={() => setViewMode("form")} className="btn-primary">Start First Request</button>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <div className="bg-green-50 border border-green-100 rounded-2xl p-4 mb-8 flex gap-4">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-green-500 flex-shrink-0 shadow-sm">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-gray-900 text-sm">Hassle-Free Buyout</h4>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  We calculate offers based on item condition, original value, and pickup difficulty. If rejected, we offer free recycling.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-600">Item Photos (Required)</label>
                <p className="text-[10px] text-gray-400">Please provide clear photos showing the current condition and any flaws.</p>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="w-24 h-24 flex-shrink-0 bg-white shadow-sm border border-gray-100 rounded-2xl flex flex-col items-center justify-center text-gray-400 hover:border-primary hover:text-primary transition-all">
                    <Camera className="w-8 h-8 mb-1" />
                    <span className="text-[10px] font-bold">Add Photo</span>
                  </button>
                  {images.map((file, i) => (
                    <div key={i} className="w-24 h-24 flex-shrink-0 relative rounded-2xl overflow-hidden group border border-gray-100 shadow-sm">
                      <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" alt="preview" />
                      <button type="button" onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
                <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*" onChange={(e) => { if (e.target.files) setImages(prev => [...prev, ...Array.from(e.target.files!)]); }} />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-bold text-gray-600">Item Name / Bundle Description</label>
                <input required className="input-field bg-white shadow-sm" placeholder="e.g. IKEA Desk & Office Chair" value={formData.itemName} onChange={e => setFormData(prev => ({ ...prev, itemName: e.target.value }))} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-bold text-gray-600">Original Price ($)</label>
                  <input required type="number" className="input-field bg-white shadow-sm" placeholder="Purchased for..." value={formData.originalPrice} onChange={e => setFormData(prev => ({ ...prev, originalPrice: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-bold text-gray-600">Current Condition</label>
                  <select className="input-field bg-white shadow-sm appearance-none" value={formData.condition} onChange={e => setFormData(prev => ({ ...prev, condition: e.target.value }))}>
                    <option value="Brand New">Brand New</option>
                    <option value="Like New">Like New</option>
                    <option value="Used - Good">Used - Good</option>
                    <option value="Used - Fair">Used - Fair (Heavy wear)</option>
                  </select>
                </div>
              </div>

              <div className="p-5 bg-white rounded-3xl border border-gray-100 shadow-sm space-y-4 mt-2">
                <h4 className="font-bold text-gray-800 flex items-center gap-2 text-sm border-b border-gray-50 pb-2">
                  <Truck className="w-4 h-4 text-primary" />
                  Pickup Logistics
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1"><MapPin className="w-3 h-3" /> Pickup Address</label>
                    <input required className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20" placeholder="Apt number, Building" value={formData.address} onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1"><Calendar className="w-3 h-3" /> Move-out Date</label>
                    <input required type="date" className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20" value={formData.moveOutDate} onChange={e => setFormData(prev => ({ ...prev, moveOutDate: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Building Access (Crucial for Quote)</label>
                  <select className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 appearance-none" value={formData.logisticsNote} onChange={e => setFormData(prev => ({ ...prev, logisticsNote: e.target.value }))}>
                    <option value="Elevator available">Elevator available in building</option>
                    <option value="Walk-up (1st/2nd Floor)">Walk-up stairs (1st or 2nd Floor)</option>
                    <option value="Walk-up (3rd Floor +)">Walk-up stairs (3rd Floor or higher)</option>
                    <option value="Item already disassembled">Item is already fully disassembled</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-bold text-gray-600">Details & Flaws</label>
                <textarea required rows={3} className="input-field bg-white shadow-sm resize-none" placeholder="Please honestly describe any scratches, missing parts, or flaws to ensure an accurate quote..." value={formData.description} onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))} />
              </div>

              <button disabled={uploading} className="btn-primary w-full mt-2 flex items-center justify-center gap-2 shadow-lg shadow-primary/20 py-4 text-base">
                {uploading ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />Submitting...</> : <><Store className="w-5 h-5" /> Request Buyout Quote</>}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}