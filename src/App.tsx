import React, { useState, useRef, useEffect, useCallback, createContext, useContext } from 'react';
import type { FC, ChangeEvent, MouseEvent, TouchEvent, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Upload, Crop, Download, RotateCw, Edit, FileImage, FileText, Trash2, CreditCard, Scan,
    Info, HelpCircle, Sun, Moon, Search, Bell, 
    Share2, UserCircle, Menu, X, ChevronDown, Briefcase, CheckCircle, AlertTriangle, Copy, LayoutGrid, Printer
} from 'lucide-react';

// --- TYPE DEFINITIONS ---
type FilterPreset = 'none' | 'magic' | 'grayscale' | 'bw';
type AppState = 'cropping' | 'editing';
type Point = { x: number; y: number };

interface FilterOption {
  id: FilterPreset;
  name:string;
  filter: string;
}

interface CroppedImage {
    id: number;
    source: string;
    cropped: string;
    corners: Point[];
    rotation: number;
}

interface ToastItem { id: number; message: string; type: 'success' | 'error' | 'info'; }

// --- APP PROVIDER & CONTEXT ---
const SIDEBAR_ITEMS = [
  { name: 'Image Scanner', icon: Scan, path: 'scanner' },
  { name: 'Gallery', icon: LayoutGrid, path: 'gallery' },
  { name: 'ID Card Maker', icon: CreditCard, path: 'id_card_maker' },
  { name: 'About', icon: Info, path: 'about' },
  { name: 'Help', icon: HelpCircle, path: 'help' },
];

const APP_NAME = "DocuTool";
const DEFAULT_THEME: 'light' | 'dark' = 'light';
const DEFAULT_PAGE = 'scanner';
const FONT_URL = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap';

interface AppContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  currentPage: string;
  setCurrentPage: (page: string) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  showShareModal: boolean;
  setShowShareModal: React.Dispatch<React.SetStateAction<boolean>>;
  showLogoutModal: boolean;
  setShowLogoutModal: React.Dispatch<React.SetStateAction<boolean>>;
  croppedImages: CroppedImage[];
  setCroppedImages: React.Dispatch<React.SetStateAction<CroppedImage[]>>;
}

const AppContext = createContext<AppContextType | null>(null);
const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within an AppProvider');
  return context;
};

// --- STYLING & LAYOUT COMPONENTS ---
const GlobalStyles: FC = () => (
    <style>{`
    :root { 
        --theme-font-family: 'Outfit', sans-serif; --theme-bg-primary: #FFFFFF; --theme-bg-secondary: #F7F9FC; --theme-bg-tertiary: #EAF0F6; --theme-content-area-bg: #F7F9FC; --theme-text-primary: #1A202C; --theme-text-secondary: #4A5568; --theme-text-tertiary: #A0AEC0; --theme-accent-primary: #3B82F6; --theme-accent-primary-text: #FFFFFF; --theme-accent-secondary: #10B981; --theme-accent-danger: #EF4444; --theme-border-primary: #E2E8F0; --theme-border-secondary: #CBD5E1; --theme-border-tertiary: #F1F5F9; --theme-shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.025), 0 1px 2px -1px rgba(0, 0, 0, 0.025); --theme-shadow-md: 0 3px 5px -1px rgba(0, 0, 0, 0.03), 0 2px 3px -2px rgba(0, 0, 0, 0.03); --theme-shadow-lg: 0 7px 10px -3px rgba(0, 0, 0, 0.04), 0 2px 4px -4px rgba(0, 0, 0, 0.04); --theme-toast-success-bg: var(--theme-accent-secondary); --theme-toast-error-bg: var(--theme-accent-danger); --theme-toast-info-bg: var(--theme-accent-primary); --theme-toast-text-color: #FFFFFF; --theme-sidebar-width: 250px; --theme-header-height: 64px; 
    }
    html.dark { 
        --theme-bg-primary: #1F2937; --theme-bg-secondary: #111827; --theme-bg-tertiary: #374151; --theme-content-area-bg: #111827; --theme-text-primary: #F3F4F6; --theme-text-secondary: #9CA3AF; --theme-text-tertiary: #6B7280; --theme-accent-primary: #60A5FA; --theme-accent-primary-text: #FFFFFF; --theme-accent-secondary: #34D399; --theme-accent-danger: #F87171; --theme-border-primary: #374151; --theme-border-secondary: #4B5563; --theme-border-tertiary: #2d333b; --theme-shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1); --theme-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.12), 0 2px 4px -2px rgba(0, 0, 0, 0.12); --theme-shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.12), 0 4px 6px -4px rgba(0, 0, 0, 0.12); 
    }
    body { font-family: var(--theme-font-family); background-color: var(--theme-content-area-bg); color: var(--theme-text-primary); margin: 0; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
    ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: var(--theme-bg-tertiary); } ::-webkit-scrollbar-thumb { background: var(--theme-text-tertiary); border-radius: 6px; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
    .animate-fadeIn { animation: fadeIn 0.25s ease-out forwards; }
    `}</style>
);

const Card: FC<{ children: ReactNode; className?: string; title?: string;}> = ({ children, className = '', title }) => (
 <div className={`bg-[var(--theme-bg-primary)] rounded-xl shadow-[var(--theme-shadow-md)] border border-[var(--theme-border-tertiary)] p-5 sm:p-6 ${className}`}>
  {title && <h3 className="text-lg font-semibold text-[var(--theme-text-primary)] mb-4">{title}</h3>}
  {children}
 </div>
);

const PageWrapper: FC<{ title: string; children: ReactNode; }> = ({ title, children }) => (
 <div className="p-5 sm:p-7 animate-fadeIn">
  <h1 className="text-xl sm:text-2xl font-semibold text-[var(--theme-text-primary)] mb-5 sm:mb-6">{title}</h1>
  {children}
 </div>
);

// --- PERSPECTIVE TRANSFORM MATH HELPERS ---
const perspectiveTransform = (src: Point[], dst: Point[]): number[] => {
    const a: number[][] = [], b: number[] = [];
    for(let i = 0; i < 4; i++) {
        a.push([src[i].x, src[i].y, 1, 0, 0, 0, -src[i].x * dst[i].x, -src[i].y * dst[i].x]);
        b.push(dst[i].x);
        a.push([0, 0, 0, src[i].x, src[i].y, 1, -src[i].x * dst[i].y, -src[i].y * dst[i].y]);
        b.push(dst[i].y);
    }
    const h = gaussianElimination(a, b);
    return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
};
const gaussianElimination = (a: number[][], b: number[]): number[] => {
    const n = a.length;
    for(let i = 0; i < n; i++) {
        let maxRow = i;
        for(let k = i + 1; k < n; k++) if(Math.abs(a[k][i]) > Math.abs(a[maxRow][i])) maxRow = k;
        [a[i], a[maxRow]] = [a[maxRow], a[i]]; [b[i], b[maxRow]] = [b[maxRow], b[i]];
        for(let k = i + 1; k < n; k++) {
            const factor = a[k][i] / a[i][i];
            for(let j = i; j < n; j++) a[k][j] -= factor * a[i][j];
            b[k] -= factor * b[i];
        }
    }
    const x = new Array(n).fill(0);
    for(let i = n - 1; i >= 0; i--) {
        let sum = 0;
        for(let j = i + 1; j < n; j++) sum += a[i][j] * x[j];
        x[i] = (b[i] - sum) / a[i][i];
    }
    return x;
};

// --- TOOL PAGES & LOGIC COMPONENT ---
const ToolPages: FC = () => {
  const { currentPage, setCurrentPage, showToast, croppedImages, setCroppedImages } = useAppContext();
  
  const [appState, setAppState] = useState<AppState | 'idle'>('idle');
  const [editingImage, setEditingImage] = useState<CroppedImage | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterPreset>('magic');
  const [corners, setCorners] = useState<Point[]>([]);
  const [draggingCornerIndex, setDraggingCornerIndex] = useState<number | null>(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0, scale: 1 });
  const [rotation, setRotation] = useState(0);
  
  const [idFront, setIdFront] = useState<{ src: string, rotation: number } | null>(null);
  const [idBack, setIdBack] = useState<{ src: string, rotation: number } | null>(null);
  const [idCardPreview, setIdCardPreview] = useState(false);
  const [isIdModalOpen, setIsIdModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [cardWidthCm, setCardWidthCm] = useState<number>(9);
  const [fileName, setFileName] = useState<string>('id-card-document');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement>(null);
  const idCardCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef(new Image());

  const filterOptions: FilterOption[] = [
    { id: 'magic', name: 'Magic', filter: 'contrast(1.4) brightness(1.2) saturate(1.1)' },
    { id: 'grayscale', name: 'Grayscale', filter: 'grayscale(1)' },
    { id: 'bw', name: 'B & W', filter: 'grayscale(1) contrast(2.5) brightness(1.1)' },
    { id: 'none', name: 'None', filter: 'none' },
  ];
  
  const processAndSetImage = useCallback((imageDataUrl: string, existingImage: Omit<CroppedImage, 'cropped'> | null = null) => {
    const img = imageRef.current;
    img.onload = () => {
        const imageToEdit = existingImage || { id: Date.now(), source: imageDataUrl, corners: [], rotation: 0 };
        setEditingImage(imageToEdit as CroppedImage);
        setCorners(imageToEdit.corners?.length === 4 ? imageToEdit.corners : [
            { x: img.width * 0.1, y: img.height * 0.1 }, { x: img.width * 0.9, y: img.height * 0.1 },
            { x: img.width * 0.9, y: img.height * 0.9 }, { x: img.width * 0.1, y: img.height * 0.9 },
        ]);
        setRotation(imageToEdit.rotation || 0);
        setAppState('cropping');
    };
    img.src = imageDataUrl;
  }, []);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
        if (currentPage !== 'scanner' || appState !== 'idle') return;
        const file = Array.from(event.clipboardData?.items || []).find(i => i.type.includes('image'))?.getAsFile();
        if (file) {
            event.preventDefault();
            const reader = new FileReader();
            reader.onload = e => typeof e.target?.result === 'string' && processAndSetImage(e.target.result);
            reader.onerror = () => showToast("Error reading pasted image.", "error");
            reader.readAsDataURL(file);
        }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [currentPage, appState, processAndSetImage, showToast]);

  const drawCropCanvas = useCallback(() => {
    const canvas = cropCanvasRef.current;
    if (!canvas || !editingImage) return;
    const ctx = canvas.getContext('2d'); const container = canvas.parentElement;
    if (!ctx || !container) return;
    const img = imageRef.current;
    const scale = Math.min(container.clientWidth / img.width, container.clientHeight / img.height, 1);
    canvas.width = img.width * scale; canvas.height = img.height * scale;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    if (corners.length === 4) {
        ctx.strokeStyle = '#3B82F6'; ctx.lineWidth = 3; ctx.beginPath();
        ctx.moveTo(corners[0].x * scale, corners[0].y * scale);
        ctx.lineTo(corners[1].x * scale, corners[1].y * scale);
        ctx.lineTo(corners[2].x * scale, corners[2].y * scale);
        ctx.lineTo(corners[3].x * scale, corners[3].y * scale);
        ctx.closePath(); ctx.stroke();
        ctx.fillStyle = '#3B82F6';
        corners.forEach(corner => { ctx.beginPath(); ctx.arc(corner.x * scale, corner.y * scale, 10, 0, 2 * Math.PI); ctx.fill(); });
    }
    setImageDimensions({ width: img.width, height: img.height, scale });
  }, [editingImage, corners]);

  useEffect(() => {
    if (appState === 'cropping') { window.addEventListener('resize', drawCropCanvas); drawCropCanvas(); }
    return () => window.removeEventListener('resize', drawCropCanvas);
  }, [appState, drawCropCanvas]);

  const getCanvasCoords = (e: MouseEvent | TouchEvent): Point => {
    const canvas = cropCanvasRef.current!; const rect = canvas.getBoundingClientRect();
    const touch = 'touches' in e ? e.touches[0] : e;
    return { x: (touch.clientX - rect.left) / imageDimensions.scale, y: (touch.clientY - rect.top) / imageDimensions.scale };
  };

  const handleApplyCrop = () => {
    const img = imageRef.current;
    if (!img.src || corners.length !== 4 || !editingImage) return;
    const w1 = Math.hypot(corners[0].x - corners[1].x, corners[0].y - corners[1].y);
    const w2 = Math.hypot(corners[3].x - corners[2].x, corners[3].y - corners[2].y);
    const h1 = Math.hypot(corners[0].x - corners[3].x, corners[0].y - corners[3].y);
    const h2 = Math.hypot(corners[1].x - corners[2].x, corners[1].y - corners[2].y);
    const maxWidth = Math.max(w1, w2); const maxHeight = Math.max(h1, h2);
    const dstCorners: Point[] = [{ x: 0, y: 0 }, { x: maxWidth, y: 0 }, { x: maxWidth, y: maxHeight }, { x: 0, y: maxHeight }];
    const invPersp = perspectiveTransform(dstCorners, corners);
    const invTransform = (m: number[], x: number, y: number): Point => {
        const d = m[6] * x + m[7] * y + 1;
        return { x: (m[0] * x + m[1] * y + m[2]) / d, y: (m[3] * x + m[4] * y + m[5]) / d };
    };
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = Math.round(maxWidth); tempCanvas.height = Math.round(maxHeight);
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true })!;
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = img.width; srcCanvas.height = img.height;
    const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true })!;
    srcCtx.drawImage(img, 0, 0);
    const srcData = srcCtx.getImageData(0, 0, img.width, img.height).data;
    const imgData = tempCtx.createImageData(tempCanvas.width, tempCanvas.height);
    for (let y = 0; y < tempCanvas.height; y++) {
        for (let x = 0; x < tempCanvas.width; x++) {
            const srcPoint = invTransform(invPersp, x, y);
            const srcX = Math.round(srcPoint.x); const srcY = Math.round(srcPoint.y);
            if (srcX >= 0 && srcX < img.width && srcY >= 0 && srcY < img.height) {
                const srcIdx = (srcY * img.width + srcX) * 4, dstIdx = (y * tempCanvas.width + x) * 4;
                imgData.data.set(srcData.subarray(srcIdx, srcIdx + 4), dstIdx);
            }
        }
    }
    tempCtx.putImageData(imgData, 0, 0);
    const croppedDataUrl = tempCanvas.toDataURL('image/jpeg', 0.95);
    const newCroppedImage = { ...editingImage, cropped: croppedDataUrl, corners, rotation: 0 };
    setCroppedImages(prev => {
        const existingIndex = prev.findIndex(item => item.id === newCroppedImage.id);
        if (existingIndex > -1) {
            const updated = [...prev];
            updated[existingIndex] = newCroppedImage;
            return updated;
        }
        return [...prev, newCroppedImage];
    });
    setEditingImage(newCroppedImage);
    setRotation(0); setActiveFilter('magic');
    setAppState('editing');
  };
  
  const getProcessedImage = useCallback((baseImage: string, rotation: number, filter: string): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d')!;
            const angle = rotation * Math.PI / 180;
            const w = img.width, h = img.height;
            const sin = Math.abs(Math.sin(angle)), cos = Math.abs(Math.cos(angle));
            canvas.width = w * cos + h * sin;
            canvas.height = w * sin + h * cos;
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(angle);
            ctx.filter = filter;
            ctx.drawImage(img, -w / 2, -h / 2);
            resolve(canvas.toDataURL('image/jpeg', 0.9));
        };
        img.src = baseImage;
    });
  }, []);

  const handleSaveChanges = async () => {
    if (!editingImage?.cropped) return;
    const finalImage = await getProcessedImage(editingImage.cropped, rotation, filterOptions.find(f => f.id === activeFilter)!.filter);
    setCroppedImages(prev => prev.map(ci => 
        ci.id === editingImage.id 
            ? { ...ci, cropped: finalImage, rotation: rotation } 
            : ci
    ));
    showToast("Changes saved to gallery!", "success");
    setAppState('idle');
    setCurrentPage('gallery');
  };

  const handleDownload = async () => {
    if (!editingImage?.cropped) return;
    const finalImage = await getProcessedImage(editingImage.cropped, rotation, filterOptions.find(f => f.id === activeFilter)!.filter);
    const link = document.createElement('a');
    link.href = finalImage;
    link.download = `scan-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleMouseDown = (e: MouseEvent | TouchEvent) => {
      e.preventDefault(); if (corners.length !== 4) return;
      const coords = getCanvasCoords(e);
      let closestCornerIndex = -1, minDistance = Infinity;
      corners.forEach((corner, index) => {
          const distance = Math.hypot(corner.x - coords.x, corner.y - coords.y);
          if (distance < 20 / imageDimensions.scale && minDistance > distance) {
              minDistance = distance; closestCornerIndex = index;
          }
      });
      if (closestCornerIndex !== -1) setDraggingCornerIndex(closestCornerIndex);
  };
  const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      e.preventDefault(); if (draggingCornerIndex === null) return;
      const coords = getCanvasCoords(e); const newCorners = [...corners];
      newCorners[draggingCornerIndex] = { x: Math.max(0, Math.min(coords.x, imageDimensions.width)), y: Math.max(0, Math.min(coords.y, imageDimensions.height)), };
      setCorners(newCorners); drawCropCanvas();
  };
  const handleMouseUp = (e: MouseEvent | TouchEvent) => { e.preventDefault(); setDraggingCornerIndex(null); };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            if (typeof e.target?.result === 'string') {
                processAndSetImage(e.target.result);
            } else showToast("Could not read the selected file.", "error");
        };
        reader.onerror = () => showToast("Error reading file.", "error");
        reader.readAsDataURL(file);
    }
    if(event.target) event.target.value = '';
  };

  const handleIdSelection = (id: number) => {
    setSelectedIds(prev => {
        if (prev.includes(id)) return prev.filter(i => i !== id);
        if (prev.length < 2) return [...prev, id];
        showToast("You can select a maximum of 2 images.", "error");
        return prev;
    });
  };

  const createIdDocument = () => {
    if (selectedIds.length === 0) { showToast("Please select at least one image.", "error"); return; }
    const selectedImages = croppedImages.filter(img => selectedIds.includes(img.id));
    setIdFront({ src: selectedImages[0].cropped, rotation: 0 });
    setIdBack(selectedImages.length > 1 ? { src: selectedImages[1].cropped, rotation: 0 } : null);
    setIsIdModalOpen(false);
    setIdCardPreview(true);
  };
  
  const drawIdCardCanvas = useCallback(() => {
    const canvas = idCardCanvasRef.current;
    if (!canvas || !idFront) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const A4_WIDTH = 2480, A4_HEIGHT = 3508;
    canvas.width = A4_WIDTH; canvas.height = A4_HEIGHT;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, A4_WIDTH, A4_HEIGHT);
    
    const cmToPx = (cm: number) => cm * 118.11; // Conversion factor for 300 DPI
    const CARD_WIDTH_PX = cmToPx(cardWidthCm);
    
    const drawRotatedImage = (imgSrc: {src: string, rotation: number}, yPos: number, callback: () => void) => {
        const img = new Image();
        img.onload = () => {
            const scale = CARD_WIDTH_PX / img.width;
            const cardHeight = img.height * scale;
            const angle = imgSrc.rotation * Math.PI / 180;
            const w = CARD_WIDTH_PX, h = cardHeight;
            ctx.save();
            ctx.translate(A4_WIDTH / 2, yPos);
            ctx.rotate(angle);
            ctx.drawImage(img, -w/2, -h/2, w, h);
            ctx.restore();
            callback();
        }
        img.src = imgSrc.src;
    };
    if (idFront && !idBack) { drawRotatedImage(idFront, A4_HEIGHT / 2, () => {}); }
    if (idFront && idBack) {
        drawRotatedImage(idFront, A4_HEIGHT * 0.33, () => {
            if (idBack) drawRotatedImage(idBack, A4_HEIGHT * 0.66, () => {});
        });
    }
  }, [idFront, idBack, cardWidthCm]);
  
  useEffect(() => {
    if(idCardPreview) {
      drawIdCardCanvas();
      const scriptId = 'jspdf-script';
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        script.async = true;
        document.body.appendChild(script);
      }
    }
  }, [idCardPreview, drawIdCardCanvas]);

  const handleDownloadIdCard = (format: 'png' | 'pdf') => {
      const canvas = idCardCanvasRef.current;
      if (!canvas) return;
      const finalFileName = `${fileName.trim() || 'id-card-document'}-${Date.now()}`;
      if (format === 'png') {
          const link = document.createElement('a');
          link.href = canvas.toDataURL('image/png');
          link.download = `${finalFileName}.png`;
          link.click();
      } else if (format === 'pdf') {
          const { jsPDF } = (window as any).jspdf;
          if(!jsPDF) { showToast("PDF library not loaded yet. Please wait a moment and try again.", "error"); return; }
          const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [canvas.width, canvas.height] });
          pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
          pdf.save(`${finalFileName}.pdf`);
      }
  };

  const handlePrint = () => {
    const canvas = idCardCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(`
            <html>
                <head><title>Print Document</title>
                    <style>
                        @media print {
                            @page { size: A4 portrait; margin: 0; }
                            body { margin: 0; }
                            img { width: 100%; height: 100%; object-fit: contain; }
                        }
                    </style>
                </head>
                <body style="margin: 0;">
                    <img src="${dataUrl}" onload="window.print(); window.close();" />
                </body>
            </html>
        `);
        printWindow.document.close();
    }
  };


  // --- RENDER METHODS ---

  if (currentPage === 'about') return <PageWrapper title="About"><Card><p>This tool helps you scan documents and create ID card sheets for printing.</p></Card></PageWrapper>;
  if (currentPage === 'help') return <PageWrapper title="Help"><Card><p>1. Go to Image Scanner to upload and crop your images.<br/>2. Go to the Gallery to view saved images.<br/>3. Go to ID Card Maker, select images, and create a printable document.</p></Card></PageWrapper>;
  
  if (idCardPreview) {
    const widthOptions = [9, 10, 11, 13];
    return (
        <div className="absolute inset-0 bg-gray-100 dark:bg-gray-800 z-[1001] flex flex-col md:flex-row">
             <div className="w-full md:w-80 flex-shrink-0 bg-[var(--theme-bg-primary)] p-4 space-y-6 overflow-y-auto">
                <h2 className="text-xl font-bold text-[var(--theme-text-primary)]">Controls</h2>
                
                <div>
                    <label className="text-sm font-medium text-[var(--theme-text-secondary)]">File Name</label>
                    <input 
                        type="text" 
                        value={fileName}
                        onChange={(e) => setFileName(e.target.value)}
                        placeholder="Enter file name"
                        className="mt-1 block w-full px-3 py-2 text-sm rounded-md border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent-primary)]"
                    />
                </div>
                
                <div>
                    <label className="text-sm font-medium text-[var(--theme-text-secondary)]">Card Width</label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                        {widthOptions.map(w => (
                            <button key={w} onClick={() => setCardWidthCm(w)}
                                className={`px-3 py-2 text-sm rounded-md border ${cardWidthCm === w ? 'bg-[var(--theme-accent-primary)] text-white border-[var(--theme-accent-primary)]' : 'bg-transparent text-[var(--theme-text-primary)] border-[var(--theme-border-secondary)] hover:bg-[var(--theme-bg-tertiary)]'}`}>
                                {w} cm
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <h3 className="text-sm font-medium text-[var(--theme-text-secondary)]">Actions</h3>
                    <button onClick={() => handleDownloadIdCard('png')} className="w-full inline-flex items-center justify-center px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700"> <FileImage className="w-5 h-5 mr-2"/> Download PNG </button>
                    <button onClick={() => handleDownloadIdCard('pdf')} className="w-full inline-flex items-center justify-center px-4 py-2 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700"> <FileText className="w-5 h-5 mr-2"/> Download PDF </button>
                    <button onClick={handlePrint} className="w-full inline-flex items-center justify-center px-4 py-2 bg-gray-600 text-white font-semibold rounded-lg shadow-md hover:bg-gray-700"> <Printer className="w-5 h-5 mr-2"/> Print </button>
                </div>

                 <button onClick={() => setIdCardPreview(false)} className="w-full mt-4 font-semibold px-4 py-2 rounded-lg text-indigo-600 hover:bg-gray-100 dark:text-indigo-400 dark:hover:bg-gray-700 border border-current">Back</button>

             </div>
             <main className="flex-grow flex justify-center items-center overflow-hidden p-4 bg-gray-200 dark:bg-gray-900">
                <canvas ref={idCardCanvasRef} className="max-w-full max-h-full h-auto w-auto object-contain shadow-lg bg-white"/>
            </main>
        </div>
    )
  }

  if (appState === 'cropping') {
    return (
        <div className="absolute inset-0 bg-gray-900 z-[1001] flex flex-col">
            <header className="flex-shrink-0 bg-white dark:bg-gray-800 shadow-md p-4 flex justify-between items-center z-10">
                <button onClick={() => setAppState('idle')} className="font-semibold px-4 py-2 rounded-lg text-[var(--theme-accent-primary)] hover:bg-[var(--theme-bg-tertiary)] transition-colors">Cancel</button>
                <h2 className="text-lg font-bold text-gray-800 dark:text-white">Adjust Corners</h2>
                <button onClick={handleApplyCrop} className="inline-flex items-center px-4 py-2 bg-[var(--theme-accent-primary)] text-white font-semibold rounded-lg shadow-md hover:opacity-90 transition-opacity">
                    <Crop className="w-5 h-5 mr-2"/> Apply Crop
                </button>
            </header>
            <main className="flex-grow flex justify-center items-center overflow-hidden p-2" onMouseUp={handleMouseUp} onTouchEnd={handleMouseUp} onMouseMove={handleMouseMove} onTouchMove={handleMouseMove}>
                <canvas ref={cropCanvasRef} className="max-w-full max-h-full cursor-move" onMouseDown={handleMouseDown} onTouchStart={handleMouseDown}/>
            </main>
        </div>
    )
  }

  if (appState === 'editing') {
    return (
        <div className="absolute inset-0 bg-gray-100 dark:bg-gray-900 z-[1001] flex flex-col">
            <header className="flex-shrink-0 bg-white dark:bg-gray-800 shadow-md p-4 flex justify-between items-center">
                <button onClick={() => setAppState('idle')} className="font-semibold px-4 py-2 rounded-lg text-[var(--theme-accent-primary)] hover:bg-[var(--theme-bg-tertiary)] transition-colors">Back to Scanner</button>
                <h2 className="text-lg font-bold text-gray-800 dark:text-white">Edit Scan</h2>
                <div className='flex gap-2'>
                    <button onClick={handleSaveChanges} className="inline-flex items-center px-4 py-2 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600 transition-opacity">
                        <CheckCircle className="w-5 h-5 mr-2"/> Save
                    </button>
                    <button onClick={handleDownload} className="inline-flex items-center px-4 py-2 bg-[var(--theme-accent-primary)] text-white font-semibold rounded-lg shadow-md hover:opacity-90 transition-opacity">
                        <Download className="w-5 h-5 mr-2"/> Download
                    </button>
                </div>
            </header>
            <main className="flex-grow p-4 overflow-y-auto flex justify-center items-center">
                {editingImage?.cropped && <img src={editingImage.cropped} alt="Cropped preview" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-all" style={{ filter: filterOptions.find(f => f.id === activeFilter)?.filter, transform: `rotate(${rotation}deg)` }}/>}
            </main>
            <footer className="flex-shrink-0 bg-white dark:bg-gray-800 p-4 shadow-[0_-2px_5px_rgba(0,0,0,0.1)]">
                <div className="flex justify-around items-center space-x-1 sm:space-x-2">
                    <button onClick={() => editingImage && processAndSetImage(editingImage.source, editingImage)} className="flex flex-col items-center space-y-2 p-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors">
                        <div className="w-12 h-12 rounded-md bg-gray-200 dark:bg-gray-700 flex items-center justify-center"><Edit className="w-6 h-6"/></div>
                        <span className="text-xs sm:text-sm font-medium">Re-Crop</span>
                    </button>
                    <button onClick={() => setRotation(r => (r + 90) % 360)} className="flex flex-col items-center space-y-2 p-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors">
                        <div className="w-12 h-12 rounded-md bg-gray-200 dark:bg-gray-700 flex items-center justify-center"><RotateCw className="w-6 h-6"/></div>
                        <span className="text-xs sm:text-sm font-medium">Rotate</span>
                    </button>
                    {filterOptions.map(({id, name, filter}) => (
                        <button key={id} onClick={() => setActiveFilter(id)} className={`flex flex-col items-center space-y-2 p-2 rounded-lg transition-transform ${activeFilter === id ? 'text-[var(--theme-accent-primary)] scale-110' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                            <div className={`w-14 sm:w-16 h-12 rounded-md bg-gray-200 border-2 ${activeFilter === id ? 'border-[var(--theme-accent-primary)]' : 'border-transparent'}`}>{editingImage?.cropped && <img src={editingImage.cropped} style={{filter}} className="w-full h-full object-cover rounded" alt="filter preview"/>}</div>
                            <span className="text-xs sm:text-sm font-medium">{name}</span>
                        </button>
                    ))}
                </div>
            </footer>
        </div>
    );
  }

  const CroppedImagesComponent: FC<{ onEdit: (img: CroppedImage) => void, selectable?: boolean, selectedIds?: number[], onSelect?: (id: number) => void }> = ({ onEdit, selectable, selectedIds, onSelect }) => {
    const { croppedImages, setCroppedImages } = useAppContext();
    return (
        <>
            {croppedImages.length === 0 ? (
                <p className="text-center py-8 text-gray-500">Your cropped images will appear here.</p>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {croppedImages.map(img => (
                        <div key={img.id} className={`relative border-2 rounded-lg overflow-hidden group ${selectable && selectedIds?.includes(img.id) ? 'border-indigo-500' : 'border-transparent'}`} 
                            onClick={() => selectable && onSelect?.(img.id)}>
                            <img src={img.cropped} className="aspect-video object-contain bg-gray-100 dark:bg-gray-800 w-full" alt="cropped item"/>
                            <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={(e) => { e.stopPropagation(); onEdit(img); }} className="p-1.5 bg-black/50 text-white rounded-full hover:bg-black/75"><Edit size={14}/></button>
                                <button onClick={(e) => { e.stopPropagation(); setCroppedImages(imgs => imgs.filter(i => i.id !== img.id)); }} className="p-1.5 bg-black/50 text-white rounded-full hover:bg-black/75"><Trash2 size={14}/></button>
                            </div>
                            {selectable && <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${selectedIds?.includes(img.id) ? 'bg-indigo-600' : 'bg-white/50 border'}`}>
                                    {selectedIds?.includes(img.id) && <CheckCircle size={16} className="text-white"/>}
                                </div>
                            </div>}
                        </div>
                    ))}
                </div>
            )}
        </>
    )
  };

  if (currentPage === 'scanner') {
      return (
          <PageWrapper title="Image Scanner">
              <Card>
                  <div className="text-center">
                      <div className="mx-auto mb-4 p-4 bg-indigo-100 dark:bg-gray-800 rounded-full inline-block"> <Scan className="w-10 h-10 text-indigo-600 dark:text-indigo-400" /> </div>
                      <h2 className="text-xl font-bold text-gray-800 dark:text-white">Scan a new document</h2>
                      <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mt-2 mb-6">Upload a file or paste an image from your clipboard to begin cropping.</p>
                      <input type="file" ref={fileInputRef} onChange={(e) => handleFileChange(e)} accept="image/*" className="hidden"/>
                      <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center justify-center px-6 py-3 bg-indigo-600 text-white font-semibold rounded-full shadow-md hover:bg-indigo-700 transition-all">
                          <Upload className="w-5 h-5 mr-2" /> Upload Image
                      </button>
                  </div>
                  <div className="mt-8">
                      <h2 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">Recently Cropped</h2>
                      <CroppedImagesComponent onEdit={(img) => processAndSetImage(img.source, img)} />
                  </div>
              </Card>
          </PageWrapper>
      )
  }

  if (currentPage === 'gallery') {
    return (
      <PageWrapper title="Gallery">
        <Card>
          <CroppedImagesComponent onEdit={(img) => processAndSetImage(img.source, img)} />
        </Card>
      </PageWrapper>
    )
  }
  
  if (currentPage === 'id_card_maker') {
    return (
        <PageWrapper title="ID Card Document Maker">
            <Card>
                <div className="text-center">
                    <div className="mx-auto mb-4 p-4 bg-indigo-100 dark:bg-gray-800 rounded-full inline-block"> <CreditCard className="w-10 h-10 text-indigo-600 dark:text-indigo-400" /> </div>
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">Create Your Document</h2>
                    <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mt-2 mb-6">Click the button below to select images from your gallery or upload new ones.</p>
                    <button onClick={() => setIsIdModalOpen(true)} className="inline-flex items-center justify-center px-6 py-3 bg-indigo-600 text-white font-semibold rounded-full shadow-md hover:bg-indigo-700 transition-all">
                        <CheckCircle className="w-5 h-5 mr-2" /> Select Images
                    </button>
                </div>
            </Card>
            <Modal isOpen={isIdModalOpen} onClose={() => setIsIdModalOpen(false)} title="Select Images for ID Card" className="max-w-3xl">
                <div className="max-h-[60vh] overflow-y-auto p-1">
                    <CroppedImagesComponent onEdit={(img) => processAndSetImage(img.source, img)} selectable selectedIds={selectedIds} onSelect={handleIdSelection}/>
                </div>
                <div className="mt-6 flex justify-between items-center">
                    <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <Upload size={16} className="mr-2"/> Upload New
                    </button>
                    <input type="file" ref={fileInputRef} onChange={(e) => handleFileChange(e)} accept="image/*" className="hidden"/>
                    <button onClick={createIdDocument} disabled={selectedIds.length === 0} className="inline-flex items-center px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed">
                        <CreditCard size={16} className="mr-2"/> Create Document ({selectedIds.length}/2)
                    </button>
                </div>
            </Modal>
        </PageWrapper>
    )
  }
  
  return <div/>;
}

const App: FC = () => {
    const [theme, setTheme] = useState<'light' | 'dark'>(DEFAULT_THEME);
    const [currentPage, _setCurrentPage] = useState<string>(DEFAULT_PAGE);
    const [isMounted, setIsMounted] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const [showShareModal, setShowShareModal] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [croppedImages, setCroppedImages] = useState<CroppedImage[]>([]);

    useEffect(() => {
        setIsMounted(true);
        const savedTheme = localStorage.getItem('app-theme') as 'light' | 'dark' || DEFAULT_THEME;
        setTheme(savedTheme);
        const hashPage = window.location.hash.substring(1);
        if (hashPage && SIDEBAR_ITEMS.some(i => i.path === hashPage)) _setCurrentPage(hashPage);
        else window.location.hash = DEFAULT_PAGE;
    }, []);

    useEffect(() => { if(isMounted) { document.documentElement.className = theme; localStorage.setItem('app-theme', theme); } }, [theme, isMounted]);

    const setCurrentPage = useCallback((page: string) => { _setCurrentPage(page); window.location.hash = page; }, []);
    
    useEffect(() => {
        const handleHashChange = () => {
            const newPage = window.location.hash.substring(1) || DEFAULT_PAGE;
            if (SIDEBAR_ITEMS.some(i => i.path === newPage)) _setCurrentPage(newPage);
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    const toggleTheme = useCallback(() => setTheme(prev => (prev === 'light' ? 'dark' : 'light')), []);
    const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToasts(prev => [...prev, { id: Date.now() + Math.random(), message, type }]);
    }, []);
    const dismissToast = useCallback((id: number) => setToasts(prev => prev.filter(t => t.id !== id)), []);

    if (!isMounted) return null;

    const appContextValue: AppContextType = { theme, toggleTheme, showToast, currentPage, setCurrentPage, isMobileMenuOpen, setIsMobileMenuOpen, showShareModal, setShowShareModal, showLogoutModal, setShowLogoutModal, croppedImages, setCroppedImages };

    return (
        <AppContext.Provider value={appContextValue}>
            <link rel="stylesheet" href={FONT_URL} />
            <GlobalStyles />
            <div className={`flex h-screen antialiased selection:bg-[var(--theme-accent-primary)] selection:text-[var(--theme-accent-primary-text)]`} style={{fontFamily: 'var(--theme-font-family)'}}>
                <Sidebar />
                <div className="flex flex-col flex-1 min-w-0">
                    <Header />
                    <main className="flex-1 overflow-y-auto bg-[var(--theme-content-area-bg)] relative">
                        <AnimatePresence mode="wait">
                            <motion.div key={currentPage} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }} className="h-full">
                                <ToolPages />
                            </motion.div>
                        </AnimatePresence>
                    </main>
                </div>
                <ToastContainer toasts={toasts} onDismiss={dismissToast} />
                <ShareModal />
                <LogoutModal />
            </div>
        </AppContext.Provider>
    );
};

interface ToastProps extends ToastItem { onDismiss: (id: number) => void; }

const Toast: FC<ToastProps> = ({ id, message, type, onDismiss }) => {
  useEffect(() => { const timer = setTimeout(() => onDismiss(id), 4000); return () => clearTimeout(timer); }, [id, onDismiss]);
  const iconMap = { success: <CheckCircle size={20}/>, error: <AlertTriangle size={20}/>, info: <Info size={20}/> };
  const bgColorVar = type === 'success' ? 'var(--theme-toast-success-bg)' : type === 'error' ? 'var(--theme-toast-error-bg)' : 'var(--theme-toast-info-bg)';
  return (
    <motion.div layout initial={{ opacity: 0, y: -20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: 30, scale: 0.95 }} transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      style={{ backgroundColor: bgColorVar, color: 'var(--theme-toast-text-color)' }} className="flex items-center py-3 px-4 rounded-lg shadow-[var(--theme-shadow-lg)] min-w-[280px]">
      <div className="mr-3 flex-shrink-0">{iconMap[type]}</div>
      <span className="flex-grow text-sm font-medium">{message}</span>
      <button onClick={() => onDismiss(id)} className="ml-2.5 p-1 rounded-full hover:bg-black/15"> <X size={16} /> </button>
    </motion.div>
  );
};

const ToastContainer: FC<{ toasts: Array<ToastItem>; onDismiss: (id: number) => void }> = ({ toasts, onDismiss }) => (
  <div className="fixed top-5 right-5 z-[1000] space-y-2.5">
    <AnimatePresence initial={false}> {toasts.map((toast) => <Toast key={toast.id} {...toast} onDismiss={onDismiss} />)} </AnimatePresence>
  </div>
);

const Sidebar: FC = () => {
    const { theme, toggleTheme, currentPage, setCurrentPage, isMobileMenuOpen, setIsMobileMenuOpen } = useAppContext();
    const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' ? window.innerWidth >= 768 : true);

    const handleLinkClick = (path: string) => { setCurrentPage(path); if(!isDesktop) setIsMobileMenuOpen(false); };
    
    useEffect(() => {
        const checkDesktop = () => setIsDesktop(window.innerWidth >= 768);
        window.addEventListener('resize', checkDesktop);
        return () => window.removeEventListener('resize', checkDesktop);
    }, []);

    const sidebarAnimationState = isDesktop ? "open" : (isMobileMenuOpen ? "open" : "closed");

    return (
        <>
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden fixed top-[16px] left-4 z-[900] p-2.5 rounded-lg bg-[var(--theme-bg-primary)] text-[var(--theme-text-secondary)] shadow-[var(--theme-shadow-md)] hover:bg-[var(--theme-bg-tertiary)]">
                <Menu size={22} />
            </button>
            <AnimatePresence>
                {isMobileMenuOpen && !isDesktop && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-[950]" onClick={() => setIsMobileMenuOpen(false)} />
                )}
            </AnimatePresence>
            <motion.aside 
                variants={{ open: { x: 0 }, closed: { x: '-100%' } }}
                animate={sidebarAnimationState}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className={`fixed top-0 left-0 h-full w-[var(--theme-sidebar-width)] bg-[var(--theme-bg-primary)] text-[var(--theme-text-primary)] border-r border-[var(--theme-border-primary)] flex flex-col z-[960] 
                md:sticky md:translate-x-0 md:shadow-none shadow-xl`}>
                <div className="h-[var(--theme-header-height)] px-4 border-b border-[var(--theme-border-primary)] flex items-center justify-between shrink-0">
                    <a href="#" onClick={() => handleLinkClick(DEFAULT_PAGE)} className="flex items-center space-x-2.5 group">
                        <div className="p-2 bg-[var(--theme-accent-primary)] rounded-lg"><Briefcase size={18} className="text-[var(--theme-accent-primary-text)]" /></div>
                        <h1 className="text-lg font-semibold tracking-tight">{APP_NAME}</h1>
                    </a>
                    <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-2 rounded-md hover:bg-[var(--theme-bg-tertiary)] text-[var(--theme-text-secondary)]"> <X size={22} /> </button>
                </div>
                <nav className="flex-grow p-3.5 space-y-1.5 overflow-y-auto">
                    {SIDEBAR_ITEMS.map((item) => (
                        <a key={item.name} href={`#${item.path}`} onClick={(e) => { e.preventDefault(); handleLinkClick(item.path); }}
                            className={`relative group flex items-center px-3.5 py-2.5 pl-4 rounded-lg text-sm font-medium
                            ${currentPage === item.path ? "bg-[var(--theme-accent-primary)] text-[var(--theme-accent-primary-text)] shadow-[var(--theme-shadow-md)]" : "text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-tertiary)] hover:text-[var(--theme-text-primary)]"}`}>
                            {currentPage === item.path && (<motion.div layoutId="activeIndicator" className="absolute left-[-12px] top-0 bottom-0 w-1.5 bg-[var(--theme-accent-primary)] rounded-r-lg"/>)}
                            <div className="flex items-center space-x-3 z-10">
                                <item.icon size={18} className={currentPage === item.path ? "text-[var(--theme-accent-primary-text)]" : "text-[var(--theme-text-tertiary)] group-hover:text-[var(--theme-text-secondary)]"}/>
                                <span> {item.name} </span>
                            </div>
                        </a>
                    ))}
                </nav>
                <div className="p-3.5 border-t border-[var(--theme-border-primary)] shrink-0">
                    <button onClick={toggleTheme} className="w-full flex items-center justify-center space-x-2 px-3 py-2.5 rounded-lg hover:bg-[var(--theme-bg-tertiary)] text-[var(--theme-text-secondary)] group border border-[var(--theme-border-tertiary)] shadow-[var(--theme-shadow-sm)]">
                        {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />} <span className="text-sm font-medium">Switch Theme</span>
                    </button>
                </div>
            </motion.aside>
        </>
    );
};
const Header: FC = () => {
    const { showToast, setShowShareModal, setShowLogoutModal } = useAppContext();
    const [userDropdownOpen, setUserDropdownOpen] = useState(false);
    return (
        <header className="bg-[var(--theme-bg-primary)] text-[var(--theme-text-primary)] border-b border-[var(--theme-border-primary)] sticky top-0 z-[800] h-[var(--theme-header-height)] flex items-center shrink-0">
            <div className="px-4 sm:px-6 w-full flex items-center justify-between">
                <div className="flex-1 max-w-lg ml-12 md:ml-0">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"> <Search size={16} className="text-[var(--theme-text-tertiary)]" /> </div>
                        <input type="search" placeholder="Search..." className="block w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent-primary)]" />
                    </div>
                </div>
                <div className="flex items-center space-x-1.5 sm:space-x-2">
                    <button onClick={() => showToast('No new notifications.', 'info')} className="p-2.5 rounded-full text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-tertiary)]"> <Bell size={20} /> </button>
                    <button onClick={() => setShowShareModal(true)} className="p-2.5 rounded-full text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-tertiary)]"> <Share2 size={20} /> </button>
                    <div className="relative">
                        <button onClick={() => setUserDropdownOpen(!userDropdownOpen)} className="flex items-center space-x-2 p-2 rounded-full hover:bg-[var(--theme-bg-tertiary)]">
                            <UserCircle size={22} className="text-[var(--theme-text-secondary)]" />
                            <span className="text-sm font-medium hidden md:inline">User</span>
                            <ChevronDown size={14} className={`text-[var(--theme-text-tertiary)] hidden md:inline transition-transform ${userDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                        <AnimatePresence>
                            {userDropdownOpen && (
                            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                                className="absolute right-0 mt-2 w-40 bg-[var(--theme-bg-primary)] rounded-lg shadow-[var(--theme-shadow-lg)] py-1.5 z-[850] border border-[var(--theme-border-primary)]">
                                <a href="#" onClick={(e) => { e.preventDefault(); showToast(`Profile clicked!`, 'info'); setUserDropdownOpen(false); }} className="block px-3.5 py-2 text-sm hover:bg-[var(--theme-bg-tertiary)]">Profile</a>
                                <a href="#" onClick={(e) => { e.preventDefault(); setShowLogoutModal(true); setUserDropdownOpen(false); }} className="block px-3.5 py-2 text-sm text-red-500 hover:bg-[var(--theme-bg-tertiary)]">Logout</a>
                            </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </header>
    );
};

const Modal: FC<{ isOpen: boolean; onClose: () => void; title: string; children: ReactNode; className?: string }> = ({ isOpen, onClose, title, children, className = 'max-w-sm' }) => {
    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
        if (isOpen) document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1002] p-4" onClick={onClose}>
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                        className={`bg-[var(--theme-bg-primary)] rounded-xl shadow-[var(--theme-shadow-lg)] w-full border border-[var(--theme-border-primary)] ${className}`} onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b border-[var(--theme-border-primary)]">
                            <h3 className="text-lg font-semibold">{title}</h3>
                            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-[var(--theme-bg-tertiary)]"> <X size={20} /> </button>
                        </div>
                        <div className="p-5">{children}</div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

const ShareModal: FC = () => {
    const { showShareModal, setShowShareModal, showToast } = useAppContext();
    const copyToClipboard = () => {
        navigator.clipboard.writeText(window.location.href)
            .then(() => showToast('Link copied!', 'success'))
            .catch(() => showToast('Failed to copy.', 'error'));
        setShowShareModal(false);
    };
    return (
        <Modal isOpen={showShareModal} onClose={() => setShowShareModal(false)} title="Share this page">
            <div className="flex items-center space-x-2">
                <input type="text" value={window.location.href} readOnly className="flex-grow p-2.5 text-xs rounded-md border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-secondary)]" />
                <button onClick={copyToClipboard} className="p-2.5 rounded-md bg-[var(--theme-accent-primary)] text-[var(--theme-accent-primary-text)] hover:opacity-90"> <Copy size={18}/> </button>
            </div>
        </Modal>
    );
};

const LogoutModal: FC = () => {
    const { showLogoutModal, setShowLogoutModal, showToast } = useAppContext();
    const handleConfirmLogout = () => { setShowLogoutModal(false); showToast("You have been logged out.", "info"); };
    return (
        <Modal isOpen={showLogoutModal} onClose={() => setShowLogoutModal(false)} title="Confirm Logout">
            <p className="text-sm text-[var(--theme-text-secondary)] mb-6">Are you sure you want to log out?</p>
            <div className="flex justify-end space-x-3">
                <button onClick={() => setShowLogoutModal(false)} className="px-4 py-2 text-sm rounded-lg border border-[var(--theme-border-secondary)] hover:bg-[var(--theme-bg-tertiary)]">Cancel</button>
                <button onClick={handleConfirmLogout} className="px-4 py-2 text-sm rounded-lg bg-[var(--theme-accent-danger)] text-white hover:opacity-90">Logout</button>
            </div>
        </Modal>
    );
};


export default App;