import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Camera, Trash2, ChevronLeft, Store, ShieldCheck, MapPin, 
  Calendar, Truck, Plus, Clock, DollarSign, AlertCircle, 
  CheckCircle, Recycle, XCircle, CalendarClock, History
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
  const [viewMode, setViewMode] = useState<"dashboard" | "form">("dashboard");
  const [requests, setRequests] = useState<AcquisitionRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [progress, setProgress] = useState(0);
  const [isValidDate, setIsValidDate] = useState(true);

  useEffect(() => {
    if (!profile?.departureDate) {
      setIsValidDate(false);
      return;
    }

    const testDate = new Date(profile.departureDate).getTime();
    if (isNaN(testDate)) {
      setIsValidDate(false);
      return;
    }
    
    setIsValidDate(true);

    const timer = setInterval(() => {
      const now = new Date().getTime();
      
      let targetTime = new Date(profile.departureDate).getTime();
      if (profile.departureDate.includes('-')) {
        const endOfDay = new Date(`${profile.departureDate}T23:59:59`).getTime();
        if (!isNaN(endOfDay)) targetTime = endOfDay;
      }

      const difference = targetTime - now;

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((difference % (1000 * 60)) / 1000)
        });
        
        const maxDaysMs = 180 * 24 * 60 * 60 * 1000; 
        const currentProg = (difference / maxDaysMs) * 100;
        setProgress(Math.max(0, Math.min(100, currentProg)));
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        setProgress(0);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [profile?.departureDate]);

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
      
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRequests(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching requests:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, [profile]);

  const handleUpdateStatus = async (id: string, newStatus: AcquisitionRequest["status"]) => {
    try {
      await updateDoc(doc(db, "platform_acquisitions", id), { status: newStatus });
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

        <div className="bg-gray-50 rounded-xl p-3">
          {req.status === "Pending Evaluation" && <p className="text-xs text-gray-500 text-center italic">Our team is reviewing your item. Please check back within 24 hours.</p>}
          {req.status === "Offer Made" && (
            <div className="space-y-3">
              <div className="text-center">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Relo Offer</p>
                <p className="text-3xl font-black text-green-500">${req.offerPrice}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleUpdateStatus(req.id, "Accepted")} className="flex-1 bg-black text-white py-2.5 rounded-xl text-xs font-bold hover:bg-gray-800 transition-all shadow-md">Accept Offer</button>
                <button onClick={() => handleUpdateStatus(req.id, "Declined")} className="flex-1 bg-white border border-gray-200 text-gray-600 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all">Decline</button>
              </div>
            </div>
          )}
          {req.status === "Rejected" && (
            <div className="space-y-3">
              <p className="text-xs text-red-500 text-center font-medium">Unfortunately, this item does not meet our buyout criteria. However, we can help you dispose of it.</p>
              <div className="flex gap-2">
                <button onClick={() => handleUpdateStatus(req.id, "Free Recycle")} className="flex-1 bg-teal-500 text-white py-2.5 rounded-xl text-xs font-bold hover:bg-teal-600 transition-all shadow-md flex items-center justify-center gap-1.5"><Recycle className="w-4 h-4" /> Recycle for Free</button>
                <button onClick={() => handleUpdateStatus(req.id, "Declined")} className="flex-1 bg-white border border-gray-200 text-gray-600 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all">I'll handle it</button>
              </div>
            </div>
          )}
          {req.status === "Accepted" && <p className="text-xs text-blue-600 text-center font-bold">Great! Our logistics team will email you to confirm the pickup time.</p>}
          {req.status === "Free Recycle" && <p className="text-xs text-teal-600 text-center font-bold">Free recycling scheduled. We will email you the pickup details.</p>}
          {req.status === "Declined" && <p className="text-xs text-gray-400 text-center italic">This request has been closed.</p>}
        </div>
      </div>
    );
  };

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
    <div className="min-h-screen bg-gray-50/50 pb-24">
      <AnimatePresence mode="wait">
        {viewMode === "dashboard" ? (
          <motion.div key="dashboard" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
            {/* 降低了亮度的更柔和的橙色主题 (orange-400) */}
            <div className="bg-orange-400 text-white px-6 pt-12 pb-20 rounded-b-[40px] shadow-lg relative overflow-hidden">
              <div className="absolute right-0 top-0 opacity-[0.05] rotate-12">
                <Clock className="w-48 h-48 text-white" />
              </div>
              
              <div className="relative z-10 max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 -ml-2 text-white hover:bg-white/20 rounded-full transition-colors">
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    <div>
                      <h1 className="text-2xl font-black mb-1 text-white tracking-tight">Relo Dashboard</h1>
                      <p className="text-white/80 text-xs font-medium">Manage your move-out inventory</p>
                    </div>
                  </div>
                </div>

                {/* 背景毛玻璃加了一点点透明白色提亮 */}
                <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 shadow-inner">
                  <div className="flex items-center gap-2 mb-4">
                    <CalendarClock className="w-4 h-4 text-white" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/80">Time until departure</span>
                  </div>
                  
                  {isValidDate ? (
                    <>
                      <div className="flex justify-between items-end mb-4">
                        <div className="flex gap-4">
                          <div><p className="text-3xl font-black text-white">{timeLeft.days}</p><p className="text-[8px] uppercase text-white/70 font-bold tracking-widest mt-0.5">Days</p></div>
                          <div><p className="text-3xl font-black text-white">{timeLeft.hours}</p><p className="text-[8px] uppercase text-white/70 font-bold tracking-widest mt-0.5">Hrs</p></div>
                          <div><p className="text-3xl font-black text-white">{timeLeft.minutes}</p><p className="text-[8px] uppercase text-white/70 font-bold tracking-widest mt-0.5">Min</p></div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-white">{Math.round(progress)}%</p>
                          <p className="text-[8px] uppercase text-white/70 font-bold tracking-widest mt-0.5">Remaining</p>
                        </div>
                      </div>
                      <div className="w-full bg-black/10 h-2 rounded-full overflow-hidden shadow-inner">
                        <div className="h-full bg-white/90 rounded-full transition-all duration-1000" style={{ width: `${progress}%` }} />
                      </div>
                    </>
                  ) : (
                    <div className="bg-white/10 border border-white/20 rounded-xl p-3 flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-white/90 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-white leading-relaxed font-medium">
                        Your departure date is unset or invalid. Go to Profile and set it to activate the countdown.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 -mt-10 max-w-2xl mx-auto relative z-20">
              <button 
                onClick={() => setViewMode("form")}
                className="w-full bg-white text-orange-400 py-4 rounded-2xl font-black shadow-xl shadow-black/5 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all mb-8 border border-gray-100"
              >
                <Plus className="w-5 h-5" /> Sell New Item to Relo
              </button>

              {loading ? (
                <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" /></div>
              ) : requests.length > 0 ? (
                <div className="space-y-4">
                  {requests.map(renderRequestCard)}
                </div>
              ) : (
                <div className="text-center py-12 bg-white rounded-3xl border-2 border-dashed border-gray-200 shadow-sm">
                  <div className="w-16 h-16 bg-orange-50 text-orange-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Store className="w-8 h-8" />
                  </div>
                  <h3 className="font-black text-gray-900 mb-2">No Requests Yet</h3>
                  <p className="text-xs text-gray-500 max-w-xs mx-auto">Got bulky furniture you can't sell? Let us make you an offer or recycle it for free.</p>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="p-6 max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-8 sticky top-0 bg-gray-50/80 backdrop-blur-md py-4 z-10 -mx-6 px-6">
              <div className="flex items-center gap-4">
                <button onClick={() => setViewMode("dashboard")} className="p-2 -ml-2 text-gray-600 hover:bg-white rounded-full transition-colors shadow-sm">
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <div>
                  <h2 className="text-xl font-black text-gray-900">Sell to Relo</h2>
                  <p className="text-xs text-gray-500 font-medium">Official Buyout & Recycle</p>
                </div>
              </div>
            </div>

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
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="w-24 h-24 flex-shrink-0 bg-white shadow-sm border border-gray-100 rounded-2xl flex flex-col items-center justify-center text-gray-400 hover:border-orange-400 hover:text-orange-400 transition-all">
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
                  <Truck className="w-4 h-4 text-orange-400" />
                  Pickup Logistics
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1"><MapPin className="w-3 h-3" /> Pickup Address</label>
                    <input required className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-400/20" placeholder="Apt number, Building" value={formData.address} onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1"><Calendar className="w-3 h-3" /> Move-out Date</label>
                    <input required type="date" onKeyDown={(e) => e.preventDefault()} onClick={(e) => { if ('showPicker' in HTMLInputElement.prototype) { e.currentTarget.showPicker(); } }} className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-400/20 cursor-pointer" value={formData.moveOutDate} onChange={e => setFormData(prev => ({ ...prev, moveOutDate: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Building Access (Crucial for Quote)</label>
                  <select className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-400/20 appearance-none" value={formData.logisticsNote} onChange={e => setFormData(prev => ({ ...prev, logisticsNote: e.target.value }))}>
                    <option value="Elevator available">Elevator available in building</option>
                    <option value="Walk-up (1st/2nd Floor)">Walk-up stairs (1st or 2nd Floor)</option>
                    <option value="Walk-up (3rd Floor +)">Walk-up stairs (3rd Floor or higher)</option>
                    <option value="Item already disassembled">Item is already fully disassembled</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-bold text-gray-600">Details & Flaws</label>
                <textarea required rows={3} className="input-field bg-white shadow-sm resize-none focus:ring-orange-400/20" placeholder="Please honestly describe any scratches, missing parts, or flaws to ensure an accurate quote..." value={formData.description} onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))} />
              </div>

              <button disabled={uploading} className="w-full bg-orange-400 text-white rounded-xl font-bold py-4 text-base mt-2 flex items-center justify-center gap-2 shadow-lg shadow-orange-400/20 hover:bg-orange-500 transition-colors">
                {uploading ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />Submitting...</> : <><Store className="w-5 h-5" /> Request Buyout Quote</>}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}