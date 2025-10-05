'use client'
import React, { useState, useRef, useEffect, useCallback, createContext, useContext, useMemo } from 'react';
import type { FC, ChangeEvent, MouseEvent, TouchEvent, ReactNode, DragEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Upload, Crop, RotateCw, Edit, FileImage, FileText, Trash2, CreditCard, Scan, Camera,
    Info, HelpCircle, Sun, Moon, Zap, ZapOff,
    Share2, Menu, X, CheckCircle, AlertTriangle, Copy, LayoutGrid, Printer, Loader2, MousePointerClick
} from 'lucide-react';

type FilterPreset = 'none' | 'magic' | 'grayscale' | 'bw';
type AppState = 'cropping' | 'editing';
type ScriptStatus = 'idle' | 'loading' | 'loaded' | 'error';
type Point = { x: number; y: number };

// NEW: Interface for Tesseract's word object for type safety
interface TesseractWord {
    text: string;
    confidence: number;
    bbox: {
        x0: number;
        y0: number;
        x1: number;
        y1: number;
    };
}

interface FilterOption {
    id: FilterPreset;
    name: string;
    filter: string;
}

interface ImageAdjustments {
    brightness: number;
    contrast: number;
    saturate: number;
    filter: FilterPreset;
}

interface CroppedImage {
    id: number;
    source: string;
    displaySource: string;
    cropped: string;
    corners: Point[];
    rotation: number;
    adjustments: ImageAdjustments;
}

interface ToastItem { id: number; message: string; type: 'success' | 'error' | 'info'; }

const CONSTANTS = {
    APP_NAME: "DocuTool",
    DEFAULT_THEME: 'dark' as 'light' | 'dark',
    DEFAULT_PAGE: 'scanner',
    FONT_URL: 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap',
    MAX_DISPLAY_DIMENSION: 1920,
    A4_WIDTH_PX_300DPI: 2480,
    A4_HEIGHT_PX_300DPI: 3508,
    CARD_CORNER_RADIUS: 35,
};

const DEFAULT_ADJUSTMENTS: ImageAdjustments = {
    brightness: 100, contrast: 100, saturate: 100, filter: 'none'
};

const SIDEBAR_ITEMS = [
    { name: 'Image Scanner', icon: Scan, path: 'scanner' },
    { name: 'Gallery', icon: LayoutGrid, path: 'gallery' },
    { name: 'ID Card Maker', icon: CreditCard, path: 'id_card_maker' },
    { name: 'About', icon: Info, path: 'about' },
    { name: 'Help', icon: HelpCircle, path: 'help' },
];

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
    croppedImages: CroppedImage[];
    setCroppedImages: React.Dispatch<React.SetStateAction<CroppedImage[]>>;
    cvStatus: ScriptStatus;
    pdfLibStatus: ScriptStatus;
    loadPdfLib: () => void;
    tesseractStatus: ScriptStatus;
    loadTesseract: () => void;
}

const AppContext = createContext<AppContextType | null>(null);
const useAppContext = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error('useAppContext must be used within an AppProvider');
    return context;
};

function useLocalStorageState<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [state, setState] = useState<T>(() => {
        if (typeof window === 'undefined') return defaultValue;
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) { console.error(error); return defaultValue; }
    });
    useEffect(() => {
        try { window.localStorage.setItem(key, JSON.stringify(state)); }
        catch (error) { console.error(error); }
    }, [key, state]);
    return [state, setState];
}

const resizeImage = (dataUrl: string, maxDimension: number, quality: number = 0.9): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const { width, height } = img;
            if (width <= maxDimension && height <= maxDimension) { resolve(dataUrl); return; }
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error("Could not get canvas context"));
            let newWidth, newHeight;
            if (width > height) { newWidth = maxDimension; newHeight = height * (maxDimension / width); }
            else { newHeight = maxDimension; newWidth = width * (maxDimension / height); }
            canvas.width = newWidth; canvas.height = newHeight;
            ctx.drawImage(img, 0, 0, newWidth, newHeight);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = dataUrl;
    });
};


const getCssFilterString = (adj: ImageAdjustments, presetOptions: FilterOption[]): string => {
    const preset = presetOptions.find(f => f.id === adj.filter);
    const presetFilter = preset ? preset.filter : 'none';
    const adjustmentFilter = `brightness(${adj.brightness / 100}) contrast(${adj.contrast / 100}) saturate(${adj.saturate / 100})`;
    return presetFilter === 'none' ? adjustmentFilter : `${presetFilter} ${adjustmentFilter}`;
};

const GlobalStyles: FC = () => (
    <style>{`
    :root {
        --theme-font-family: 'Outfit', sans-serif; --theme-bg-primary: #FFFFFF; --theme-bg-secondary: #F7F9FC; --theme-bg-tertiary: #EAF0F6; --theme-content-area-bg: #F7F9FC; --theme-text-primary: #1A202C; --theme-text-secondary: #4A5568; --theme-text-tertiary: #A0AEC0; --theme-accent-primary: #3B82F6; --theme-accent-primary-text: #FFFFFF; --theme-accent-secondary: #10B981; --theme-accent-danger: #EF4444; --theme-border-primary: #E2E8F0; --theme-border-secondary: #CBD5E1; --theme-border-tertiary: #F1F5F9; --theme-shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.025), 0 1px 2px -1px rgba(0, 0, 0, 0.025); --theme-shadow-md: 0 3px 5px -1px rgba(0, 0, 0, 0.03), 0 2px 3px -2px rgba(0, 0, 0, 0.03); --theme-shadow-lg: 0 7px 10px -3px rgba(0, 0, 0, 0.04), 0 2px 4px -4px rgba(0, 0, 0, 0.04); --theme-toast-success-bg: var(--theme-accent-secondary); --theme-toast-error-bg: var(--theme-accent-danger); --theme-toast-info-bg: var(--theme-accent-primary); --theme-toast-text-color: #FFFFFF; --theme-sidebar-width: 250px; --theme-header-height: 64px;
    }
    html.dark {
        --theme-bg-primary: #1F2937; --theme-bg-secondary: #111827; --theme-bg-tertiary: #374151; --theme-content-area-bg: #111827; --theme-text-primary: #F3F4F6; --theme-text-secondary: #9CA3AF; --theme-text-tertiary: #6B7280; --theme-accent-primary: #60A5FA; --theme-accent-primary-text: #FFFFFF; --theme-accent-secondary: #34D399; --theme-accent-danger: #F87171; --theme-border-primary: #374151; --theme-border-secondary: #4B5563; --theme-border-tertiary: #2d333b; --theme-shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1); --theme-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.12), 0 2px 4px -2px rgba(0, 0, 0, 0.12); --theme-shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.12), 0 4px 6px -4px rgba(0, 0, 0, 0.12);
    }
    body { font-family: var(--theme-font-family); background-color: var(--theme-content-area-bg); color: var(--theme-text-primary); margin: 0; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
    .main-content-bg {
        background-color: var(--theme-content-area-bg);
        background-image: radial-gradient(var(--theme-border-primary) 1px, transparent 1px);
        background-size: 20px 20px;
    }
    html.dark .main-content-bg {
        background-image: radial-gradient(var(--theme-border-primary) 0.5px, transparent 0.5px);
        background-size: 25px 25px;
    }
    ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: var(--theme-bg-tertiary); } ::-webkit-scrollbar-thumb { background: var(--theme-text-tertiary); border-radius: 6px; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
    .animate-fadeIn { animation: fadeIn 0.25s ease-out forwards; }
    .hide-scrollbar::-webkit-scrollbar { display: none; } .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    @keyframes pulse-dot { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.5); opacity: 0.7; } }
    .animate-pulse-dot { animation: pulse-dot 1.5s ease-in-out infinite; }
    `}</style>
);

const Card: FC<{ children: ReactNode; className?: string; title?: string; }> = ({ children, className = '', title }) => (
    <div className={`bg-[var(--theme-bg-primary)] rounded-xl shadow-[var(--theme-shadow-md)] border border-[var(--theme-border-tertiary)] p-4 sm:p-6 ${className}`}>
        {title && <h3 className="text-lg font-semibold text-[var(--theme-text-primary)] mb-4">{title}</h3>}
        {children}
    </div>
);

const PageWrapper: FC<{ title: string; children: ReactNode; }> = ({ title, children }) => (
    <div className="p-4 sm:p-6 md:p-8 animate-fadeIn">
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--theme-text-primary)] mb-5 sm:mb-6">{title}</h1>
        {children}
    </div>
);

interface CroppedImagesComponentProps {
    onEdit: (img: CroppedImage) => void;
    onCopy: (base64: string) => void;
    selectable?: boolean;
    selectedIds?: number[];
    onSelect?: (id: number) => void;
    onImageClick?: (img: CroppedImage) => void;
}

const CroppedImagesComponent: FC<CroppedImagesComponentProps> = React.memo(({ onEdit, onCopy, selectable, selectedIds, onSelect, onImageClick }) => {
    const { croppedImages, setCroppedImages } = useAppContext();
    return (
        <>
            {croppedImages.length === 0 ? (
                 <div className="text-center py-10 px-4">
                      <LayoutGrid size={40} className="mx-auto text-gray-300 dark:text-gray-600" />
                      <h3 className="mt-2 text-sm font-medium text-gray-500">No Scanned Images</h3>
                      <p className="mt-1 text-sm text-gray-400">Go to the scanner to add some.</p>
                 </div>
            ) : (
                 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                     {croppedImages.map(img => (
                          <div key={img.id} className={`relative border-2 rounded-lg overflow-hidden group shadow-sm transition-all hover:shadow-lg hover:border-blue-500/50 ${selectable && selectedIds?.includes(img.id) ? 'border-blue-500' : 'border-transparent'}`}
                               onClick={() => {
                                   if (selectable && onSelect) {
                                       onSelect(img.id);
                                   } else if (onImageClick) {
                                       onImageClick(img);
                                   }
                               }}>
                              <img src={img.cropped} className="aspect-[4/3] object-contain bg-gray-100 dark:bg-gray-800 w-full rounded-md" alt="cropped item" style={{ borderRadius: '6px' }} />
                              <div className="absolute top-1.5 right-1.5 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button aria-label="Copy Image" onClick={(e) => { e.stopPropagation(); onCopy(img.cropped); }} className="p-1.5 bg-black/50 text-white rounded-full hover:bg-black/75"><Copy size={14} /></button>
                                  <button aria-label="Edit Image" onClick={(e) => { e.stopPropagation(); onEdit(img); }} className="p-1.5 bg-black/50 text-white rounded-full hover:bg-black/75"><Edit size={14} /></button>
                                  <button aria-label="Delete Image" onClick={(e) => { e.stopPropagation(); setCroppedImages(imgs => imgs.filter(i => i.id !== img.id)); }} className="p-1.5 bg-black/50 text-white rounded-full hover:bg-black/75"><Trash2 size={14} /></button>
                              </div>
                              {selectable && (
                                   <div className={`absolute inset-0 flex items-center justify-center transition-all cursor-pointer ${selectedIds?.includes(img.id) ? 'bg-black/50' : 'bg-black/0 group-hover:bg-black/50'}`}>
                                       <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${selectedIds?.includes(img.id) ? 'bg-blue-600 scale-100' : 'bg-white/50 border scale-0 group-hover:scale-100'}`}>
                                           {selectedIds?.includes(img.id) && <CheckCircle size={16} className="text-white" />}
                                       </div>
                                   </div>
                              )}
                          </div>
                     ))}
                 </div>
            )}
        </>
    )
});
CroppedImagesComponent.displayName = 'CroppedImagesComponent';

const ImageDetailModal: FC<{ image: CroppedImage | null; onClose: () => void; }> = ({ image, onClose }) => {
    const { showToast, tesseractStatus, loadTesseract, cvStatus } = useAppContext();
    const [ocrData, setOcrData] = useState<TesseractWord[]>([]);
    const [isOcrRunning, setIsOcrRunning] = useState(false);
    const [ocrMessage, setOcrMessage] = useState('Start OCR');

    const [editableText, setEditableText] = useState('');
    const [rawOcrText, setRawOcrText] = useState('');
    const [averageConfidence, setAverageConfidence] = useState(0);

    const [selectionBox, setSelectionBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectedWords, setSelectedWords] = useState<TesseractWord[]>([]);

    const imageContainerRef = useRef<HTMLDivElement>(null);
    const [imageDimensions, setImageDimensions] = useState({ width: 1, height: 1 });

    // NEW: State for controlling preprocessing
    const [usePreprocessing, setUsePreprocessing] = useState(true);

    const preprocessImageForOCR = async (imageUrl: string): Promise<string> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                const cv = (window as any).cv;
                if (!cv) {
                    showToast('OpenCV not ready for preprocessing.', 'error');
                    resolve(imageUrl);
                    return;
                }
                try {
                    const src = cv.imread(img);
                    const gray = new cv.Mat();
                    const blurred = new cv.Mat();
                    const thresh = new cv.Mat();
                    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
                    // Params for blur (Size(5,5)) and adaptiveThreshold (11, 2) can be tweaked for different image types.
                    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
                    cv.adaptiveThreshold(blurred, thresh, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 11, 2);
                    
                    const canvas = document.createElement('canvas');
                    cv.imshow(canvas, thresh);
                    resolve(canvas.toDataURL('image/png'));

                    src.delete(); gray.delete(); blurred.delete(); thresh.delete();
                } catch (error) {
                    console.error("Preprocessing error:", error);
                    showToast("Image preprocessing failed.", "error");
                    resolve(imageUrl);
                }
            };
            img.src = imageUrl;
        });
    };

    useEffect(() => {
        setOcrData([]);
        setSelectedWords([]);
        setSelectionBox(null);
        setEditableText('');
        setRawOcrText('');
        setAverageConfidence(0);

        if (image) {
            loadTesseract();
            const img = new Image();
            img.onload = () => setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
            img.src = image.cropped;
        }
    }, [image, loadTesseract]);

    const handleExtractText = async () => {
        if (!image || tesseractStatus !== 'loaded' || (usePreprocessing && cvStatus !== 'loaded')) {
            showToast('OCR engine or preprocessor not ready.', 'error');
            return;
        }
        setIsOcrRunning(true);
        setOcrData([]);
        
        try {
            let imageUrlToProcess = image.cropped;
            if (usePreprocessing) {
                setOcrMessage('Preprocessing image...');
                imageUrlToProcess = await preprocessImageForOCR(image.cropped);
            }

            setOcrMessage('Recognizing text...');
            const { Tesseract } = window as any;
            const worker = await Tesseract.createWorker('eng');
            const { data } = await worker.recognize(imageUrlToProcess);
            
            const confidentWords = data.words.filter((w: TesseractWord) => w.confidence > 60);
            const totalConfidence = confidentWords.reduce((acc: number, word: TesseractWord) => acc + word.confidence, 0);
            setAverageConfidence(confidentWords.length > 0 ? Math.round(totalConfidence / confidentWords.length) : 0);
            
            setOcrData(confidentWords);
            setEditableText(data.text);
            setRawOcrText(data.text);
            
            showToast(`OCR complete.`, 'success');
            await worker.terminate();
        } catch (error) {
            console.error("OCR Error:", error);
            showToast('Failed to extract text from image.', 'error');
        } finally {
            setIsOcrRunning(false);
            setOcrMessage('Start OCR');
        }
    };
    
    // FIX: Re-formatted and typed the minified function
    const getSelectionRect = () => {
        if (!selectionBox) return null;
        const x = Math.min(selectionBox.x1, selectionBox.x2);
        const y = Math.min(selectionBox.y1, selectionBox.y2);
        const width = Math.abs(selectionBox.x1 - selectionBox.x2);
        const height = Math.abs(selectionBox.y1 - selectionBox.y2);
        return { x, y, width, height };
    };
    
    const checkIntersection = (
        wordBbox: TesseractWord['bbox'],
        selectionRect: { x: number, y: number, width: number, height: number },
        scaleX: number,
        scaleY: number
    ) => {
        const wordRect = {
            x: wordBbox.x0 * scaleX, y: wordBbox.y0 * scaleY,
            width: (wordBbox.x1 - wordBbox.x0) * scaleX, height: (wordBbox.y1 - wordBbox.y0) * scaleY,
        };
        return !(
            wordRect.x > selectionRect.x + selectionRect.width ||
            wordRect.x + wordRect.width < selectionRect.x ||
            wordRect.y > selectionRect.y + selectionRect.height ||
            wordRect.y + wordRect.height < selectionRect.y
        );
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (ocrData.length === 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setIsSelecting(true);
        setSelectionBox({ x1: x, y1: y, x2: x, y2: y });
        setSelectedWords([]);
    };
    
    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isSelecting || !selectionBox) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setSelectionBox({ ...selectionBox, x2: x, y2: y });
        const selectionRect = getSelectionRect();
        const container = imageContainerRef.current;
        if (!selectionRect || !container) return;
        const scaleX = container.clientWidth / imageDimensions.width;
        const scaleY = container.clientHeight / imageDimensions.height;
        setSelectedWords(ocrData.filter(word => checkIntersection(word.bbox, selectionRect, scaleX, scaleY)));
    };
    
    const handleMouseUp = () => setIsSelecting(false);

    const selectedText = useMemo(() => {
        if (selectedWords.length === 0) return "";
        return [...selectedWords]
            .sort((a, b) => {
                if (Math.abs(a.bbox.y0 - b.bbox.y0) > 10) return a.bbox.y0 - b.bbox.y0;
                return a.bbox.x0 - b.bbox.x0;
            })
            .map(word => word.text)
            .join(' ');
    }, [selectedWords]);

    const handleCopySelection = () => {
        if (!selectedText) return;
        navigator.clipboard.writeText(selectedText)
            .then(() => showToast('Selected text copied!', 'success'))
            .catch(() => showToast('Failed to copy text.', 'error'));
    };

    const handleCopyEditableText = () => {
        navigator.clipboard.writeText(editableText)
          .then(() => showToast('Text copied to clipboard!', 'success'))
          .catch(() => showToast('Failed to copy text.', 'error'));
    };

    if (!image) return null;
    const selectionRect = getSelectionRect();
    const container = imageContainerRef.current;
    const scaleX = container ? container.clientWidth / imageDimensions.width : 1;
    const scaleY = container ? container.clientHeight / imageDimensions.height : 1;

    return (
        <Modal isOpen={!!image} onClose={onClose} title="Image Details & OCR" className="max-w-4xl w-full">
            <div className="flex flex-col md:flex-row gap-6 max-h-[80vh]">
                <div className="md:w-1/2 flex-shrink-0 relative">
                     <div 
                        ref={imageContainerRef}
                        className="relative w-full h-auto max-h-[75vh] select-none bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden"
                        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} >
                        <img src={image.cropped} alt="Detail view" className="w-full h-full object-contain pointer-events-none" />
                        {ocrData.length > 0 && (
                            <div className="absolute top-0 left-0 w-full h-full cursor-text">
                                {ocrData.map((word, i) => (
                                    <div key={i} title={word.text} className={`absolute ${selectedWords.some(sw => sw === word) ? 'bg-blue-500/40' : 'hover:bg-blue-500/20'}`} style={{
                                        left: `${word.bbox.x0 * scaleX}px`, top: `${word.bbox.y0 * scaleY}px`,
                                        width: `${(word.bbox.x1 - word.bbox.x0) * scaleX}px`, height: `${(word.bbox.y1 - word.bbox.y0) * scaleY}px`
                                    }} />
                                ))}
                                {selectionRect && <div className="absolute border-2 border-dashed border-blue-600 bg-blue-500/20" style={{
                                    left: selectionRect.x, top: selectionRect.y, width: selectionRect.width, height: selectionRect.height
                                }} />}
                            </div>
                        )}
                    </div>
                    <AnimatePresence>
                        {selectedText && (
                            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                                className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
                                <button onClick={handleCopySelection} className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg shadow-lg text-sm hover:bg-gray-700">
                                    <Copy size={14} /> Copy Selection
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
                <div className="md:w-1/2 flex flex-col min-h-0">
                    <h4 className="font-semibold text-lg mb-2">Text Recognition (OCR)</h4>
                    <div className="flex items-center justify-between gap-4 mb-4">
                        <button
                            onClick={handleExtractText}
                            disabled={isOcrRunning || tesseractStatus !== 'loaded'}
                            className="w-full inline-flex items-center justify-center px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-all text-sm disabled:bg-gray-400 disabled:cursor-not-allowed" >
                            {isOcrRunning ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <FileText className="w-5 h-5 mr-2" />}
                            {isOcrRunning ? ocrMessage : 'Start OCR'}
                        </button>
                        <label className="flex items-center gap-2 text-sm text-[var(--theme-text-secondary)] whitespace-nowrap cursor-pointer">
                            <input type="checkbox" checked={usePreprocessing} onChange={(e) => setUsePreprocessing(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                            Preprocess
                        </label>
                    </div>
                    
                    <AnimatePresence>
                        {rawOcrText && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex-grow flex flex-col min-h-0">
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-sm font-medium">Editable Text</label>
                                    <span className="text-xs font-mono px-2 py-1 rounded bg-gray-200 dark:bg-gray-700" title="Average confidence of recognized words">Confidence: {averageConfidence}%</span>
                                </div>
                                <textarea
                                    value={editableText}
                                    onChange={(e) => setEditableText(e.target.value)}
                                    className="w-full flex-grow p-2 border border-[var(--theme-border-secondary)] rounded-md bg-[var(--theme-bg-secondary)] min-h-[150px] text-sm"
                                    placeholder="Extracted text will appear here." />
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
                                    <button onClick={handleCopyEditableText} className="p-2 text-xs rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600">Copy All</button>
                                    <button onClick={() => setEditableText(editableText.replace(/\s+/g, ' ').trim())} className="p-2 text-xs rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600">Trim Spaces</button>
                                    <button onClick={() => setEditableText(editableText.toUpperCase())} className="p-2 text-xs rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600">UPPERCASE</button>
                                    <button onClick={() => setEditableText(editableText.toLowerCase())} className="p-2 text-xs rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600">lowercase</button>
                                    <button onClick={() => setEditableText(rawOcrText)} className="p-2 text-xs rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600">Reset</button>
                                    <button onClick={() => setEditableText('')} className="p-2 text-xs rounded-md bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300 hover:bg-red-300 dark:hover:bg-red-900">Clear</button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </Modal>
    );
};

// ... (The rest of the file (ToolPages, App, etc.) remains the same as the previous correct version)
const ToolPages: FC = () => {
    const { currentPage, showToast, croppedImages, setCroppedImages, cvStatus, pdfLibStatus, loadPdfLib } = useAppContext();

    const [appState, setAppState] = useState<AppState | 'idle'>('idle');
    const [editingImage, setEditingImage] = useState<CroppedImage | null>(null);
    const [imageAdjustments, setImageAdjustments] = useState<ImageAdjustments>(DEFAULT_ADJUSTMENTS);
    const [corners, setCorners] = useState<Point[]>([]);
    const [draggingCornerIndex, setDraggingCornerIndex] = useState<number | null>(null);
    const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0, scale: 1 });
    const [rotation, setRotation] = useState(0);
    const [isIdModalOpen, setIsIdModalOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [idCardPreview, setIdCardPreview] = useState(false);
    const [cardWidthCm, setCardWidthCm] = useState<number>(9);
    const [fileName, setFileName] = useState<string>('id-card-document');
    const [isGallerySelectMode, setIsGallerySelectMode] = useState(false);
    const [gallerySelection, setGallerySelection] = useState<number[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingMessage, setProcessingMessage] = useState('Processing...');
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [torchSupported, setTorchSupported] = useState(false);
    const [torchOn, setTorchOn] = useState(false);
    const [isCaptureMode, setIsCaptureMode] = useState(false);
    const [capturingCornerIndex, setCapturingCornerIndex] = useState<number | null>(null);
    const [selectedImageForDetail, setSelectedImageForDetail] = useState<CroppedImage | null>(null);
    const [isPdfRenameModalOpen, setIsPdfRenameModalOpen] = useState(false);
    const [pdfFileName, setPdfFileName] = useState('docutool-export');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const cropCanvasRef = useRef<HTMLCanvasElement>(null);
    const idCardCanvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef(new Image());
    const originalImageRef = useRef(new Image());
    const animationFrameIdRef = useRef<number | null>(null);
    const lastMoveEventRef = useRef<MouseEvent | TouchEvent | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const filterOptions: FilterOption[] = useMemo(() => [
        { id: 'none', name: 'None', filter: 'none' },
        { id: 'magic', name: 'Magic', filter: 'contrast(1.4) brightness(1.2) saturate(1.1)' },
        { id: 'grayscale', name: 'Grayscale', filter: 'grayscale(1)' },
        { id: 'bw', name: 'B & W', filter: 'grayscale(1) contrast(2.5) brightness(1.1)' },
    ], []);
    
    const handleCaptureToggle = () => {
        const newCaptureModeState = !isCaptureMode;
        setIsCaptureMode(newCaptureModeState);
        if (newCaptureModeState) {
            setCapturingCornerIndex(0);
        } else {
            setCapturingCornerIndex(null);
        }
    };

    const handleCopyImage = useCallback(async (base64Data: string) => {
        if (!navigator.clipboard?.write) {
            showToast('Clipboard API not available in this browser/context.', 'error');
            return;
        }
        try {
            const blob = await (await fetch(base64Data)).blob();
            if (typeof ClipboardItem !== 'undefined') {
                const clipboardItem = new ClipboardItem({ [blob.type]: blob });
                await navigator.clipboard.write([clipboardItem]);
                showToast('Image copied to clipboard!', 'success');
            } else {
                showToast('Cannot copy images directly in this browser.', 'info');
            }
        } catch (err: any) {
            console.error('Failed to copy image: ', err);
            let message = 'Failed to copy image.';
            if (err.name === 'NotAllowedError') {
                message = 'Clipboard permission denied by browser.';
            } else if (err.name === 'SecurityError') {
                message = 'Copying requires a secure context (HTTPS).';
            }
            showToast(message, 'error');
        }
    }, [showToast]);
    
    const detectDocumentCorners = useCallback((img: HTMLImageElement): Point[] | null => {
        if (cvStatus !== 'loaded') return null;
        const cv = (window as any).cv;
        let src: any, gray: any, blurred: any, edged: any, contours: any, hierarchy: any, kernel: any;
        try {
            src = cv.imread(img);
            gray = new cv.Mat();
            cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
            blurred = new cv.Mat();
            cv.bilateralFilter(gray, blurred, 11, 17, 17);
            edged = new cv.Mat();
            cv.Canny(blurred, edged, 30, 200);
            kernel = cv.Mat.ones(5, 5, cv.CV_8U);
            cv.morphologyEx(edged, edged, cv.MORPH_CLOSE, kernel);
            contours = new cv.MatVector();
            hierarchy = new cv.Mat();
            cv.findContours(edged, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
            let maxArea = 0;
            let bestContour: any = null;
            const minArea = img.width * img.height / 50;
            for (let i = 0; i < contours.size(); ++i) {
                const cnt = contours.get(i);
                const area = cv.contourArea(cnt);
                if (area > minArea) {
                    const peri = cv.arcLength(cnt, true);
                    const approx = new cv.Mat();
                    cv.approxPolyDP(cnt, approx, 0.02 * peri, true);
                    if (approx.rows === 4 && area > maxArea) {
                        maxArea = area;
                        if (bestContour) bestContour.delete();
                        bestContour = approx.clone();
                    }
                    approx.delete();
                }
                cnt.delete();
            }
            if (bestContour) {
                const rawPoints: number[] = Array.from(bestContour.data32S as Int32Array);
                const points: Point[] = [];
                for (let i = 0; i < rawPoints.length; i += 2) {
                    points.push({ x: rawPoints[i], y: rawPoints[i+1] });
                }
                bestContour.delete();
                points.sort((a, b) => a.y - b.y);
                const top = points.slice(0, 2).sort((a, b) => a.x - b.x);
                const bottom = points.slice(2, 4).sort((a,b) => a.x > b.x ? -1 : 1);
                return [top[0], top[1], bottom[0], bottom[1]];
            }
        } catch (e) { 
            console.error("OpenCV error:", e); 
            showToast("Auto-detection failed.", "error"); 
        } finally {
            if (src) src.delete();
            if (gray) gray.delete();
            if (blurred) blurred.delete();
            if (edged) edged.delete();
            if (contours) contours.delete();
            if (hierarchy) hierarchy.delete();
            if (kernel) kernel.delete();
        }
        return null;
    }, [cvStatus, showToast]);

    const processAndSetImage = useCallback(async (imageDataUrl: string, existingImage: CroppedImage | null = null) => {
        setIsProcessing(true);
        setProcessingMessage('Loading Image...');
        try {
            const displayUrl = await resizeImage(imageDataUrl, CONSTANTS.MAX_DISPLAY_DIMENSION);
            const img = imageRef.current;
            img.onload = () => {
                originalImageRef.current.src = imageDataUrl;
                const imageToEdit = existingImage || {
                    id: Date.now(), source: imageDataUrl, displaySource: displayUrl, cropped: '',
                    corners: [], rotation: 0, adjustments: DEFAULT_ADJUSTMENTS
                };
                let initialCorners: Point[] | null = null;
                if (existingImage && existingImage.corners && existingImage.corners.length === 4) {
                    initialCorners = existingImage.corners;
                } else {
                    setProcessingMessage('Detecting Document...');
                    initialCorners = detectDocumentCorners(img);
                }
                setEditingImage(imageToEdit);
                setCorners(initialCorners || [
                    { x: 0, y: 0 }, { x: img.width, y: 0 },
                    { x: img.width, y: img.height }, { x: 0, y: img.height },
                ]);
                setRotation(imageToEdit.rotation || 0);
                setImageAdjustments(imageToEdit.adjustments || DEFAULT_ADJUSTMENTS);
                setAppState('cropping');
                setIsCaptureMode(false);
                setCapturingCornerIndex(null);
                setIsProcessing(false);
            };
            img.src = displayUrl;
        } catch (error) { showToast("Failed to process image.", "error"); setIsProcessing(false); }
    }, [detectDocumentCorners, showToast]);

    const handleApplyCrop = async () => {
        if (cvStatus !== 'loaded') { showToast("Cropping engine not ready. Please wait.", "error"); return; }
        setIsProcessing(true);
        setProcessingMessage('Applying Crop...');
        setTimeout(async () => {
            try {
                const cv = (window as any).cv;
                const displayImg = imageRef.current; const originalImg = originalImageRef.current;
                if (!originalImg.src || corners.length !== 4 || !editingImage) { throw new Error("Initial conditions for crop not met."); }
                const scaleRatio = originalImg.width / displayImg.width;
                const scaledCorners = corners.map(p => ({ x: p.x * scaleRatio, y: p.y * scaleRatio }));
                const w1 = Math.hypot(scaledCorners[0].x - scaledCorners[1].x, scaledCorners[0].y - scaledCorners[1].y);
                const w2 = Math.hypot(scaledCorners[3].x - scaledCorners[2].x, scaledCorners[3].y - scaledCorners[2].y);
                const h1 = Math.hypot(scaledCorners[0].x - scaledCorners[3].x, scaledCorners[0].y - scaledCorners[3].y);
                const h2 = Math.hypot(scaledCorners[1].x - scaledCorners[2].x, scaledCorners[1].y - scaledCorners[2].y);
                const maxWidth = Math.max(w1, w2); const maxHeight = Math.max(h1, h2);
                const srcPoints = scaledCorners.flatMap(p => [p.x, p.y]);
                const dstPoints = [0, 0, maxWidth, 0, maxWidth, maxHeight, 0, maxHeight];
                let srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, srcPoints);
                let dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, dstPoints);
                let M = cv.getPerspectiveTransform(srcTri, dstTri);
                let src = cv.imread(originalImg); let dst = new cv.Mat();
                let dsize = new cv.Size(maxWidth, maxHeight);
                cv.warpPerspective(src, dst, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
                const tempCanvas = document.createElement('canvas');
                cv.imshow(tempCanvas, dst);
                const highQualityCroppedUrl = tempCanvas.toDataURL('image/jpeg', 0.95);
                const croppedDataUrl = await resizeImage(highQualityCroppedUrl, 2000, 0.92);
                src.delete(); dst.delete(); M.delete(); srcTri.delete(); dstTri.delete();
                const newAdjustments: ImageAdjustments = { ...DEFAULT_ADJUSTMENTS };
                const newCroppedImage: CroppedImage = { ...editingImage, cropped: croppedDataUrl, corners, rotation: 0, adjustments: newAdjustments };
                setCroppedImages(prev => {
                    const existingIndex = prev.findIndex(item => item.id === newCroppedImage.id);
                    if (existingIndex > -1) { const updated = [...prev]; updated[existingIndex] = newCroppedImage; return updated; }
                    return [...prev, newCroppedImage];
                });
                setEditingImage(newCroppedImage);
                setRotation(0);
                setImageAdjustments(newAdjustments);
                setAppState('editing');
            } catch (error) {
                console.error("Error during crop:", error); showToast("Failed to apply crop.", "error");
            } finally { setIsProcessing(false); }
        }, 100);
    };

    const drawIdCardCanvas = useCallback(() => {
        const canvas = idCardCanvasRef.current;
        const selectedImages = selectedIds.map(id => croppedImages.find(img => img.id === id)).filter((img): img is CroppedImage => !!img);
        if (!canvas || selectedImages.length === 0) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        canvas.width = CONSTANTS.A4_WIDTH_PX_300DPI;
        canvas.height = CONSTANTS.A4_HEIGHT_PX_300DPI;
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const cmToPx = (cm: number) => cm * 118.11;
        const CARD_WIDTH_PX = cmToPx(cardWidthCm);
        const idFront = selectedImages[0];
        const idBack = selectedImages.length > 1 ? selectedImages[1] : null;
        const drawRoundedImage = (img: HTMLImageElement, x: number, y: number, width: number, height: number, radius: number) => {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + width - radius, y); ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
            ctx.lineTo(x + width, y + height - radius); ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            ctx.lineTo(x + radius, y + height); ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
            ctx.lineTo(x, y + radius); ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(img, x, y, width, height);
            ctx.restore();
        };
        const drawImageOnCanvas = (imgData: CroppedImage, yPos: number, callback: () => void) => {
            const img = new Image();
            img.onload = () => {
                const scale = CARD_WIDTH_PX / img.width;
                const cardHeight = img.height * scale;
                const x = (canvas.width - CARD_WIDTH_PX) / 2;
                const y = yPos - (cardHeight / 2);
                drawRoundedImage(img, x, y, CARD_WIDTH_PX, cardHeight, CONSTANTS.CARD_CORNER_RADIUS);
                callback();
            };
            img.src = imgData.cropped;
        };
        if (idFront && !idBack) { drawImageOnCanvas(idFront, canvas.height / 2, () => { }); }
        else if (idFront && idBack) {
            drawImageOnCanvas(idFront, canvas.height * 0.33, () => {
                if (idBack) drawImageOnCanvas(idBack, canvas.height * 0.66, () => { });
            });
        }
    }, [selectedIds, croppedImages, cardWidthCm]);

    const handleSaveIdCardToGallery = () => {
        const canvas = idCardCanvasRef.current;
        if (!canvas) {
            showToast('Could not save to gallery.', 'error');
            return;
        }
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        const newImage: CroppedImage = {
            id: Date.now(),
            source: dataUrl,
            displaySource: dataUrl,
            cropped: dataUrl,
            corners: [],
            rotation: 0,
            adjustments: DEFAULT_ADJUSTMENTS,
        };
        setCroppedImages(prev => [...prev, newImage]);
        showToast('ID card sheet saved to gallery!', 'success');
    };

    useEffect(() => {
        const startCamera = async () => {
            if (isCameraOpen && videoRef.current) {
                try {
                    const constraints = { video: { facingMode: 'environment' } };
                    const stream = await navigator.mediaDevices.getUserMedia(constraints);
                    videoRef.current.srcObject = stream;
                    streamRef.current = stream;
                    setTimeout(() => {
                        const track = stream.getVideoTracks()[0];
                        if (track) {
                           const capabilities = track.getCapabilities();
                            setTorchSupported(!!(capabilities as any).torch);
                        }
                    }, 500);
                } catch (err) {
                    console.error("Camera error:", err);
                    showToast("Could not access camera. Please check permissions.", "error");
                    setIsCameraOpen(false);
                }
            }
        };
        startCamera();
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
                setTorchOn(false);
                setTorchSupported(false);
            }
        };
    }, [isCameraOpen, showToast]);

    const handleCapturePhoto = () => {
        if (!videoRef.current) return;
        const video = videoRef.current; const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d'); if (!ctx) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setIsCameraOpen(false);
        processAndSetImage(dataUrl);
    };

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
        const canvas = cropCanvasRef.current; if (!canvas || !editingImage) return;
        const ctx = canvas.getContext('2d'); const container = canvas.parentElement;
        if (!ctx || !container) return;
        const img = imageRef.current;
        const margin = 32;
        const availableWidth = container.clientWidth - margin * 2;
        const availableHeight = container.clientHeight - margin * 2;
        const scale = Math.min(availableWidth / img.width, availableHeight / img.height);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        if (corners.length === 4) {
            ctx.strokeStyle = '#3B82F6'; ctx.lineWidth = 3; ctx.beginPath();
            ctx.moveTo(corners[0].x * scale, corners[0].y * scale);
            ctx.lineTo(corners[1].x * scale, corners[1].y * scale);
            ctx.lineTo(corners[2].x * scale, corners[2].y * scale);
            ctx.lineTo(corners[3].x * scale, corners[3].y * scale);
            ctx.closePath();
            ctx.stroke();
            corners.forEach((corner, index) => {
                ctx.beginPath();
                const isDragging = index === draggingCornerIndex;
                const isCapturing = isCaptureMode && index === capturingCornerIndex;
                const radius = isDragging || isCapturing ? 14 : 10;
                ctx.arc(corner.x * scale, corner.y * scale, radius, 0, 2 * Math.PI);
                ctx.fillStyle = isDragging ? '#F59E0B' : (isCapturing ? '#10B981' : '#3B82F6');
                if (isCapturing) {
                    const pulseScale = 1 + Math.sin(Date.now() / 200) * 0.2;
                    ctx.arc(corner.x * scale, corner.y * scale, radius * pulseScale, 0, 2 * Math.PI);
                }
                ctx.fill();
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 2;
                ctx.stroke();
            });
        }
        if (isCaptureMode && capturingCornerIndex !== null) {
            const cornerLabels = ['Top-Left', 'Top-Right', 'Bottom-Right', 'Bottom-Left'];
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.font = 'bold 16px ' + CONSTANTS.FONT_URL;
            ctx.textAlign = 'center';
            ctx.fillText(`Click to set the ${cornerLabels[capturingCornerIndex]} corner`, canvas.width / 2, 30);
        }
        setImageDimensions({ width: img.width, height: img.height, scale });
    }, [editingImage, corners, draggingCornerIndex, isCaptureMode, capturingCornerIndex]);


    useEffect(() => {
        if (appState === 'cropping') { window.addEventListener('resize', drawCropCanvas); drawCropCanvas(); }
        return () => window.removeEventListener('resize', drawCropCanvas);
    }, [appState, drawCropCanvas]);

    useEffect(() => {
        if (appState !== 'cropping') return;
        let animationFrameId: number;
        const animate = () => {
            drawCropCanvas();
            animationFrameId = requestAnimationFrame(animate);
        };
        if (isCaptureMode) {
            animate();
        }
        return () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, [isCaptureMode, appState, drawCropCanvas]);


    const getCanvasCoords = (e: MouseEvent | TouchEvent): Point => {
        const canvas = cropCanvasRef.current!; const rect = canvas.getBoundingClientRect();
        const touch = 'touches' in e ? e.touches[0] : e;
        return { x: (touch.clientX - rect.left) / imageDimensions.scale, y: (touch.clientY - rect.top) / imageDimensions.scale };
    };

    const getProcessedImage = useCallback((baseImage: string, rotation: number, adjustments: ImageAdjustments): Promise<string> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d')!;
                const angle = rotation * Math.PI / 180; const w = img.width, h = img.height;
                const sin = Math.abs(Math.sin(angle)), cos = Math.abs(Math.cos(angle));
                canvas.width = w * cos + h * sin; canvas.height = w * sin + h * cos;
                ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate(angle);
                ctx.filter = getCssFilterString(adjustments, filterOptions);
                ctx.drawImage(img, -w / 2, -h / 2);
                resolve(canvas.toDataURL('image/jpeg', 0.92));
            };
            img.src = baseImage;
        });
    }, [filterOptions]);

    const handleSaveChanges = async () => {
        if (!editingImage?.cropped) return;
        setIsProcessing(true);
        setProcessingMessage('Saving Changes...');
        const finalImage = await getProcessedImage(editingImage.cropped, rotation, imageAdjustments);
        setCroppedImages(prev => prev.map(ci =>
            ci.id === editingImage.id
                ? { ...ci, cropped: finalImage, rotation: rotation, adjustments: imageAdjustments }
                : ci
        ));
        showToast("Changes saved!", "success");
        setAppState('idle');
        setIsProcessing(false);
    };

    const handleMouseDown = (e: MouseEvent | TouchEvent) => {
        e.preventDefault(); if (corners.length !== 4) return;
        const coords = getCanvasCoords(e);
        let closestCornerIndex = -1, minDistance = Infinity;
        corners.forEach((corner, index) => {
            const distance = Math.hypot(corner.x - coords.x, corner.y - coords.y);
            if (distance < 25 / imageDimensions.scale && minDistance > distance) {
                minDistance = distance; closestCornerIndex = index;
            }
        });
        if (closestCornerIndex !== -1) {
            setDraggingCornerIndex(closestCornerIndex);
            if (navigator.vibrate) navigator.vibrate(50);
        }
    };

    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
        if (draggingCornerIndex === null) return;
        e.preventDefault();
        lastMoveEventRef.current = e;
        if (!animationFrameIdRef.current) {
            animationFrameIdRef.current = requestAnimationFrame(() => {
                if (lastMoveEventRef.current && draggingCornerIndex !== null) {
                    const coords = getCanvasCoords(lastMoveEventRef.current);
                    const newCorners = [...corners];
                    newCorners[draggingCornerIndex] = {
                        x: Math.max(0, Math.min(coords.x, imageDimensions.width)),
                        y: Math.max(0, Math.min(coords.y, imageDimensions.height)),
                    };
                    setCorners(newCorners);
                    drawCropCanvas();
                }
                animationFrameIdRef.current = null;
            });
        }
    };

    const handleMouseUp = (e: MouseEvent | TouchEvent) => {
        e.preventDefault();
        if (animationFrameIdRef.current) {
            cancelAnimationFrame(animationFrameIdRef.current);
            animationFrameIdRef.current = null;
        }
        setDraggingCornerIndex(null);
    };

    const handleCanvasClickCapture = (e: MouseEvent | TouchEvent) => {
        e.preventDefault();
        if (capturingCornerIndex === null) return;
        const coords = getCanvasCoords(e);
        const newCorners = [...corners];
        newCorners[capturingCornerIndex] = {
            x: Math.max(0, Math.min(coords.x, imageDimensions.width)),
            y: Math.max(0, Math.min(coords.y, imageDimensions.height)),
        };
        setCorners(newCorners);
        if (capturingCornerIndex < 3) {
            setCapturingCornerIndex(capturingCornerIndex + 1);
        } else {
            setCapturingCornerIndex(null);
            setIsCaptureMode(false);
        }
    };

    const handleCanvasInteractionStart = (e: MouseEvent | TouchEvent) => {
        if (isCaptureMode) {
            handleCanvasClickCapture(e);
        } else {
            handleMouseDown(e);
        }
    };

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
        if (event.target) event.target.value = '';
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
        setIsIdModalOpen(false);
        setIdCardPreview(true);
    };

    useEffect(() => {
        if (idCardPreview) {
            loadPdfLib();
            drawIdCardCanvas();
        }
    }, [idCardPreview, drawIdCardCanvas, loadPdfLib, cardWidthCm]);

    const handleDownloadIdCard = (format: 'jpeg' | 'pdf') => {
        const canvas = idCardCanvasRef.current; if (!canvas) return;
        const finalFileName = `${fileName.trim() || 'id-card-document'}`;
        if (format === 'jpeg') {
            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/jpeg', 0.92);
            link.download = `${finalFileName}.jpg`;
            link.click();
        } else if (format === 'pdf') {
            if (pdfLibStatus !== 'loaded') {
                showToast("PDF library not ready. Please wait a moment.", "info");
                return;
            }
            const { jsPDF } = (window as any).jspdf;
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [canvas.width, canvas.height] });
            pdf.addImage(canvas.toDataURL('image/jpeg', 0.85), 'JPEG', 0, 0, canvas.width, canvas.height);
            pdf.save(`${finalFileName}.pdf`);
        }
    };

    const handlePrint = () => {
        const canvas = idCardCanvasRef.current; if (!canvas) return;
        const dataUrl = canvas.toDataURL("image/png");
        const printWindow = window.open("", "_blank");
        if (printWindow) {
            printWindow.document.write(`<html><head><title>Print Document</title><style>@page { size: A4 portrait; margin: 0; } body { margin: 0; } img { width: 100vw; height: 100vh; object-fit: contain; }</style></head><body><img src="${dataUrl}" /></body></html>`);
            const img = printWindow.document.querySelector('img');
            if (img) {
                img.onload = () => { printWindow.print(); printWindow.close(); };
            }
            printWindow.document.close();
        } else {
            showToast("Pop-up blocked. Please allow pop-ups for this site.", "error");
        }
    };

    const handleShare = async () => {
        const canvas = idCardCanvasRef.current; if (!canvas) return;
        if (!navigator.share) {
            showToast("Web Share is not supported on your browser.", "error");
            return;
        }
        const finalFileName = `${fileName.trim() || 'id-card-document'}.png`;
        canvas.toBlob(async (blob) => {
            if (!blob) {
                showToast("Failed to create file for sharing.", "error");
                return;
            }
            const file = new File([blob], finalFileName, { type: 'image/png' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        files: [file],
                        title: 'ID Card Document',
                        text: `Here is the document: ${finalFileName}`,
                    });
                    showToast("Shared successfully!", "success");
                } catch (error) {
                    console.error("Share failed:", error);
                    showToast("Could not share the file.", "error");
                }
            } else {
                showToast("Sharing files is not supported on your device.", "error");
            }
        }, 'image/png');
    };

    const handleGallerySelection = (id: number) => {
        setGallerySelection(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const executePdfCreation = async () => {
        if (gallerySelection.length === 0) return;
        setIsProcessing(true);
        setProcessingMessage('Creating PDF...');
        loadPdfLib();
        if (pdfLibStatus !== 'loaded') {
            showToast("PDF library not ready, please wait and try again.", "info");
            setIsProcessing(false);
            return;
        }
        const { jsPDF } = (window as any).jspdf;
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' });
        for (let i = 0; i < gallerySelection.length; i++) {
            const imgData = croppedImages.find(img => img.id === gallerySelection[i]);
            if (imgData) {
                if (i > 0) pdf.addPage();
                const img = new Image();
                img.src = imgData.cropped;
                await new Promise(resolve => img.onload = resolve);
                const pageWidth = pdf.internal.pageSize.getWidth();
                const pageHeight = pdf.internal.pageSize.getHeight();
                const imgRatio = img.width / img.height;
                const pageRatio = pageWidth / pageHeight;
                let imgWidth, imgHeight;
                if (imgRatio > pageRatio) {
                    imgWidth = pageWidth;
                    imgHeight = pageWidth / imgRatio;
                } else {
                    imgHeight = pageHeight;
                    imgWidth = pageHeight * imgRatio;
                }
                const x = (pageWidth - imgWidth) / 2;
                const y = (pageHeight - imgHeight) / 2;
                pdf.addImage(imgData.cropped, 'JPEG', x, y, imgWidth, imgHeight);
            }
        }
        const finalFileName = `${pdfFileName.trim() || 'docutool-export'}.pdf`;
        pdf.save(finalFileName);
        setIsPdfRenameModalOpen(false);
        setIsGallerySelectMode(false);
        setGallerySelection([]);
        setIsProcessing(false);
    };

    const handleDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); };
    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault(); e.stopPropagation();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (ev) => typeof ev.target?.result === 'string' && processAndSetImage(ev.target.result);
                reader.readAsDataURL(file);
            } else {
                showToast("Please drop an image file.", "error");
            }
            e.dataTransfer.clearData();
        }
    };
    
    const toggleTorch = async () => {
        if (!streamRef.current || !torchSupported) return;
        const track = streamRef.current.getVideoTracks()[0];
        try {
            await track.applyConstraints({
                advanced: [{ torch: !torchOn } as any]
            });
            setTorchOn(!torchOn);
        } catch (err) {
            console.error('Error toggling torch:', err);
            showToast('Could not control flash.', 'error');
        }
    };

    if (isProcessing) {
        return (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-[2000] flex flex-col items-center justify-center text-white">
                <Loader2 className="w-12 h-12 animate-spin mb-4" />
                <p className="text-lg font-semibold">{processingMessage}</p>
            </div>
        )
    }

    if (currentPage === 'about') return <PageWrapper title="About"><Card><p>This tool helps you scan documents and create ID card sheets for printing.</p></Card></PageWrapper>;
    if (currentPage === 'help') return <PageWrapper title="Help"><Card><p>1. Go to Image Scanner to upload and crop your images.<br />2. Go to the Gallery to view saved images.<br />3. Go to ID Card Maker, select images, and create a printable document.</p></Card></PageWrapper>;

    if (idCardPreview) {
        const widthOptions = [8, 9, 10, 11, 13, 15, 16, 17];
        return (
            <div className="absolute inset-0 bg-gray-100 dark:bg-gray-800 z-[1001] flex flex-col md:flex-row">
                <div className="w-full md:w-80 flex-shrink-0 bg-[var(--theme-bg-primary)] p-4 sm:p-5 space-y-5 overflow-y-auto">
                    <h2 className="text-xl font-bold text-[var(--theme-text-primary)]">Controls</h2>
                    <div>
                        <label className="text-sm font-medium text-[var(--theme-text-secondary)] mb-1.5 block">File Name</label>
                        <input type="text" value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="Enter file name" className="w-full px-3 py-2 text-sm rounded-md border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent-primary)]" />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-[var(--theme-text-secondary)] mb-2 block">Card Width</label>
                        <div className="grid grid-cols-4 gap-2">
                            {widthOptions.map(w => (<button key={w} onClick={() => setCardWidthCm(w)} className={`px-3 py-2 text-sm rounded-md border transition-colors ${cardWidthCm === w ? 'bg-[var(--theme-accent-primary)] text-white border-[var(--theme-accent-primary)]' : 'bg-transparent text-[var(--theme-text-primary)] border-[var(--theme-border-secondary)] hover:bg-[var(--theme-bg-tertiary)]'}`}>{w} cm</button>))}
                        </div>
                    </div>
                    <div className="space-y-2.5">
                        <h3 className="text-sm font-medium text-[var(--theme-text-secondary)]">Actions</h3>
                        <button onClick={handleSaveIdCardToGallery} className="w-full inline-flex items-center justify-center px-4 py-2.5 bg-teal-600 text-white font-semibold rounded-lg shadow-md hover:bg-teal-700 transition-all text-sm"><LayoutGrid className="w-4 h-4 mr-2" /> Save to Gallery</button>
                        <button onClick={() => handleCopyImage(idCardCanvasRef.current?.toDataURL('image/png') ?? '')} className="w-full inline-flex items-center justify-center px-4 py-2.5 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 transition-all text-sm"><Copy className="w-4 h-4 mr-2" /> Copy Document</button>
                        <button onClick={() => handleDownloadIdCard('jpeg')} className="w-full inline-flex items-center justify-center px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-all text-sm"><FileImage className="w-4 h-4 mr-2" /> Download JPG</button>
                        <button onClick={() => handleDownloadIdCard('pdf')} disabled={pdfLibStatus !== 'loaded'} className="w-full inline-flex items-center justify-center px-4 py-2.5 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all text-sm">{pdfLibStatus === 'loading' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />} Download PDF</button>
                        <button onClick={handlePrint} className="w-full inline-flex items-center justify-center px-4 py-2.5 bg-gray-600 text-white font-semibold rounded-lg shadow-md hover:bg-gray-700 transition-all text-sm"><Printer className="w-4 h-4 mr-2" /> Print</button>
                        <button onClick={handleShare} className="w-full inline-flex items-center justify-center px-4 py-2.5 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 transition-all text-sm"><Share2 className="w-4 h-4 mr-2" /> Share</button>
                    </div>
                    <button onClick={() => setIdCardPreview(false)} className="w-full mt-4 font-semibold px-4 py-2.5 rounded-lg text-blue-600 hover:bg-gray-100 dark:text-blue-400 dark:hover:bg-gray-700 border border-current text-sm">Back</button>
                </div>
                <main className="flex-grow flex justify-center items-center overflow-hidden p-4 bg-gray-200 dark:bg-gray-900"><canvas ref={idCardCanvasRef} className="max-w-full max-h-full h-auto w-auto object-contain shadow-lg bg-white" /></main>
            </div>
        )
    }

    if (appState === 'cropping') {
        return (
            <div className="absolute inset-0 bg-gray-900 z-[1001] flex flex-col">
                <header className="flex-shrink-0 bg-white dark:bg-gray-800 shadow-md p-3 sm:p-4 flex justify-between items-center z-10">
                    <button onClick={() => setAppState('idle')} className="font-semibold px-4 py-2 rounded-lg text-[var(--theme-accent-primary)] hover:bg-[var(--theme-bg-tertiary)] transition-colors text-sm sm:text-base">Cancel</button>
                    <div className="flex items-center gap-2">
                         <button onClick={handleCaptureToggle} className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${isCaptureMode ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                              <MousePointerClick className="w-4 h-4 mr-2" /> {isCaptureMode ? 'Capturing...' : 'Capture Corners'}
                         </button>
                         <button onClick={handleApplyCrop} className="inline-flex items-center px-4 py-2 bg-[var(--theme-accent-primary)] text-white font-semibold rounded-lg shadow-md hover:opacity-90 transition-opacity text-sm sm:text-base">
                              <Crop className="w-4 h-4 sm:w-5 sm:h-5 mr-2" /> Apply
                         </button>
                    </div>
                </header>
                <main className="flex-grow flex justify-center items-center overflow-hidden p-4 sm:p-8 touch-none relative" onMouseUp={handleMouseUp} onTouchEnd={handleMouseUp} onMouseMove={handleMouseMove} onTouchMove={handleMouseMove}>
                    <canvas ref={cropCanvasRef} className="max-w-full max-h-full" onMouseDown={handleCanvasInteractionStart} onTouchStart={handleCanvasInteractionStart} />
                </main>
            </div>
        )
    }
    
     if (isCameraOpen) {
        return (
            <div className="absolute inset-0 bg-black z-[1001] flex flex-col">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover"></video>
                <div className="absolute top-4 right-4 flex flex-col gap-4">
                           {torchSupported && (
                                <button
                                    onClick={toggleTorch}
                                    className={`p-3 rounded-full transition-colors ${torchOn ? 'bg-amber-400 text-gray-900' : 'bg-black/50 text-white'}`}
                                >
                                    {torchOn ? <ZapOff size={24} /> : <Zap size={24} />}
                                </button>
                           )}
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent flex justify-center items-center">
                    <button aria-label="Cancel" onClick={() => setIsCameraOpen(false)} className="absolute left-4 text-white font-semibold px-4 py-2 rounded-lg">Cancel</button>
                    <button aria-label="Capture Photo" onClick={handleCapturePhoto} className="p-4 bg-white rounded-full shadow-lg group">
                        <div className="w-12 h-12 rounded-full bg-white ring-4 ring-white/50 group-hover:scale-110 transition-transform"></div>
                    </button>
                </div>
            </div>
        )
    }

    if (appState === 'editing') {
        const fullCssFilter = getCssFilterString(imageAdjustments, filterOptions);
        return (
            <div className="absolute inset-0 bg-gray-100 dark:bg-gray-900 z-[1001] flex flex-col">
                <header className="flex-shrink-0 bg-white dark:bg-gray-800 shadow-md p-3 sm:p-4 flex justify-between items-center">
                    <button onClick={() => setAppState('idle')} className="font-semibold px-4 py-2 rounded-lg text-[var(--theme-accent-primary)] hover:bg-[var(--theme-bg-tertiary)] transition-colors text-sm sm:text-base">Back</button>
                    <h2 className="text-base sm:text-lg font-bold text-gray-800 dark:text-white">Edit Scan</h2>
                    <div className='flex items-center gap-2'>
                        <button aria-label="Copy Image" onClick={() => handleCopyImage(editingImage?.cropped ?? '')} className="p-2.5 rounded-lg text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-tertiary)]"> <Copy size={20} /> </button>
                        <button onClick={handleSaveChanges} className="inline-flex items-center px-4 py-2 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600 transition-opacity text-sm sm:text-base">
                            <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 mr-2" /> Save
                        </button>
                    </div>
                </header>
                <main className="flex-grow p-4 overflow-y-auto flex justify-center items-center">
                    {editingImage?.cropped && <img src={editingImage.cropped} alt="Cropped preview" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-all" style={{ filter: fullCssFilter, transform: `rotate(${rotation}deg)` }} />}
                </main>
                <footer className="flex-shrink-0 bg-white dark:bg-gray-800 p-4 shadow-[0_-2px_5px_rgba(0,0,0,0.1)]">
                    <div className="w-full overflow-x-auto hide-scrollbar pb-2">
                        <div className="flex justify-start sm:justify-center items-center space-x-2">
                            <button onClick={() => editingImage && processAndSetImage(editingImage.source, editingImage)} className="flex flex-col items-center space-y-1 p-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 flex-shrink-0">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-md bg-gray-200 dark:bg-gray-700 flex items-center justify-center"><Edit className="w-5 h-5 sm:w-6 sm:h-6" /></div>
                                <span className="text-xs sm:text-sm font-medium">Re-Crop</span>
                            </button>
                            <button onClick={() => setRotation(r => (r + 90) % 360)} className="flex flex-col items-center space-y-1 p-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 flex-shrink-0">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-md bg-gray-200 dark:bg-gray-700 flex items-center justify-center"><RotateCw className="w-5 h-5 sm:w-6 sm:h-6" /></div>
                                <span className="text-xs sm:text-sm font-medium">Rotate</span>
                            </button>
                            {filterOptions.map(({ id, name, filter }) => (
                                <button key={id} onClick={() => setImageAdjustments(adj => ({ ...adj, filter: id }))} className={`flex flex-col items-center space-y-1 p-2 rounded-lg transition-transform flex-shrink-0 ${imageAdjustments.filter === id ? 'text-[var(--theme-accent-primary)] scale-105' : 'text-gray-600 dark:text-gray-300'}`}>
                                    <div className={`w-14 h-10 sm:w-16 sm:h-12 rounded-md bg-gray-200 border-2 overflow-hidden ${imageAdjustments.filter === id ? 'border-[var(--theme-accent-primary)]' : 'border-transparent'}`}>{editingImage?.cropped && <img src={editingImage.cropped} style={{ filter }} className="w-full h-full object-cover" alt="filter preview" />}</div>
                                    <span className="text-xs sm:text-sm font-medium">{name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-2 max-w-lg mx-auto pt-4 border-t border-[var(--theme-border-primary)]">
                        {(['brightness', 'contrast', 'saturate'] as const).map(adj => (
                            <div key={adj}>
                                <label className="text-xs font-medium text-gray-500 capitalize">{adj}</label>
                                <input type="range" min="0" max="200" value={imageAdjustments[adj]}
                                    onChange={(e) => setImageAdjustments(prev => ({ ...prev, [adj]: Number(e.target.value) }))}
                                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700" />
                            </div>
                        ))}
                    </div>
                </footer>
            </div>
        );
    }

    if (currentPage === 'scanner') {
        return (
            <PageWrapper title="Image Scanner">
                <Card>
                    <div className="text-center" onDragOver={handleDragOver} onDrop={handleDrop}>
                        <div className="mx-auto mb-4 p-4 bg-blue-100 dark:bg-gray-800 rounded-full inline-block"> <Scan className="w-10 h-10 text-blue-600 dark:text-blue-400" /> </div>
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">Scan a new document</h2>
                        <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mt-2 mb-6">Drag & drop an image, paste, capture from your camera, or click to upload.</p>
                        <input type="file" ref={fileInputRef} onChange={(e) => handleFileChange(e)} accept="image/*" className="hidden" />
                        <div className="flex flex-col sm:flex-row justify-center items-center gap-3 sm:gap-4">
                            <button onClick={() => fileInputRef.current?.click()} className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-full shadow-md hover:bg-blue-700 transition-all">
                                <Upload className="w-5 h-5 mr-2" /> Upload Image
                            </button>
                            <button onClick={() => setIsCameraOpen(true)} className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 bg-gray-600 text-white font-semibold rounded-full shadow-md hover:bg-gray-700 transition-all">
                                <Camera className="w-5 h-5 mr-2" /> Capture Image
                            </button>
                        </div>
                        {cvStatus !== 'loaded' && <p className="text-xs text-yellow-500 mt-3">{cvStatus === 'loading' ? 'Loading auto-detection engine...' : 'Auto-detection failed. Manual cropping is available.'}</p>}
                    </div>
                    <div className="mt-8">
                        <h2 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">Recently Cropped</h2>
                        <CroppedImagesComponent onEdit={(img) => processAndSetImage(img.source, img)} onCopy={handleCopyImage} onImageClick={(img) => setSelectedImageForDetail(img)} />
                    </div>
                </Card>
                <ImageDetailModal image={selectedImageForDetail} onClose={() => setSelectedImageForDetail(null)} />
            </PageWrapper>
        )
    }

    if (currentPage === 'gallery') {
        return (
            <PageWrapper title="Gallery">
                <Card>
                    <div className="flex justify-end mb-4 gap-2">
                        {isGallerySelectMode && (
                            <button 
                                onClick={() => setIsPdfRenameModalOpen(true)}
                                disabled={gallerySelection.length === 0 || pdfLibStatus !== 'loaded'}
                                className="inline-flex items-center px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400"
                            >
                                {pdfLibStatus === 'loading' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText size={16} className="mr-2" />} 
                                {gallerySelection.length > 1 ? `Combine to PDF (${gallerySelection.length})` : 'Save as PDF'}
                            </button>
                        )}
                        <button onClick={() => { setIsGallerySelectMode(s => !s); setGallerySelection([]); }} className="inline-flex items-center px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                            {isGallerySelectMode ? "Cancel" : "Select"}
                        </button>
                    </div>
                    <CroppedImagesComponent onEdit={(img) => processAndSetImage(img.source, img)} onCopy={handleCopyImage} selectable={isGallerySelectMode} selectedIds={gallerySelection} onSelect={handleGallerySelection} onImageClick={(img) => !isGallerySelectMode && setSelectedImageForDetail(img)} />
                </Card>
                 <Modal isOpen={isPdfRenameModalOpen} onClose={() => setIsPdfRenameModalOpen(false)} title="Name Your PDF">
                     <div>
                         <label className="text-sm font-medium text-[var(--theme-text-secondary)] mb-1.5 block">File Name</label>
                         <input 
                             type="text" 
                             value={pdfFileName} 
                             onChange={(e) => setPdfFileName(e.target.value)} 
                             placeholder="Enter file name" 
                             className="w-full px-3 py-2 text-sm rounded-md border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent-primary)]" 
                         />
                     </div>
                     <div className="mt-6 flex justify-end">
                         <button onClick={executePdfCreation} className="inline-flex items-center px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                             <FileText size={16} className="mr-2" /> Create PDF
                         </button>
                     </div>
                 </Modal>
                <ImageDetailModal image={selectedImageForDetail} onClose={() => setSelectedImageForDetail(null)} />
            </PageWrapper>
        )
    }

    if (currentPage === 'id_card_maker') {
        return (
            <PageWrapper title="ID Card Document Maker">
                <Card>
                    <div className="text-center">
                        <div className="mx-auto mb-4 p-4 bg-blue-100 dark:bg-gray-800 rounded-full inline-block"> <CreditCard className="w-10 h-10 text-blue-600 dark:text-blue-400" /> </div>
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">Create Your Document</h2>
                        <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mt-2 mb-6">Click the button below to select images from your gallery to generate a printable document.</p>
                        <button onClick={() => setIsIdModalOpen(true)} className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-full shadow-md hover:bg-blue-700 transition-all">
                            <CheckCircle className="w-5 h-5 mr-2" /> Select Images
                        </button>
                    </div>
                </Card>
                <Modal isOpen={isIdModalOpen} onClose={() => setIsIdModalOpen(false)} title="Select Images for ID Card (1 or 2)" className="max-w-3xl">
                    <div className="max-h-[60vh] overflow-y-auto p-1">
                        <CroppedImagesComponent onEdit={(img) => processAndSetImage(img.source, img)} onCopy={handleCopyImage} selectable selectedIds={selectedIds} onSelect={handleIdSelection} />
                    </div>
                    <div className="mt-6 flex justify-between items-center">
                        <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                            <Upload size={16} className="mr-2" /> Upload New
                        </button>
                        <input type="file" ref={fileInputRef} onChange={(e) => handleFileChange(e)} accept="image/*" className="hidden" />
                        <button onClick={createIdDocument} disabled={selectedIds.length === 0} className="inline-flex items-center px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
                            <CreditCard size={16} className="mr-2" /> Create Document ({selectedIds.length}/2)
                        </button>
                    </div>
                </Modal>
            </PageWrapper>
        )
    }

    return null;
}

const App: FC = () => {
    const [theme, setTheme] = useLocalStorageState<'light' | 'dark'>('app-theme', CONSTANTS.DEFAULT_THEME);
    const [currentPage, _setCurrentPage] = useState<string>(CONSTANTS.DEFAULT_PAGE);
    const [isMounted, setIsMounted] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const [showShareModal, setShowShareModal] = useState(false);
    const [croppedImages, setCroppedImages] = useLocalStorageState<CroppedImage[]>('docutool-images', []);
    const [cvStatus, setCvStatus] = useState<ScriptStatus>('loading');
    const [pdfLibStatus, setPdfLibStatus] = useState<ScriptStatus>('idle');
    const [tesseractStatus, setTesseractStatus] = useState<ScriptStatus>('idle');

    const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToasts(prev => [...prev, { id: Date.now() + Math.random(), message, type }]);
    }, []);

    const loadPdfLib = useCallback(() => {
        if (pdfLibStatus === 'idle') {
            setPdfLibStatus('loading');
            const scriptId = 'jspdf-script';
            if (document.getElementById(scriptId)) {
                if ((window as any).jspdf) setPdfLibStatus('loaded');
                return;
            }
            const script = document.createElement('script');
            script.id = scriptId;
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script.async = true;
            script.onload = () => setPdfLibStatus('loaded');
            script.onerror = () => { setPdfLibStatus('error'); showToast("Failed to load PDF library.", "error"); }
            document.body.appendChild(script);
        }
    }, [pdfLibStatus, showToast]);

    const loadTesseract = useCallback(() => {
        if (tesseractStatus === 'idle') {
            setTesseractStatus('loading');
            const scriptId = 'tesseract-script';
            if (document.getElementById(scriptId)) {
                if ((window as any).Tesseract) setTesseractStatus('loaded');
                return;
            }
            const script = document.createElement('script');
            script.id = scriptId;
            script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
            script.async = true;
            script.onload = () => setTesseractStatus('loaded');
            script.onerror = () => { setTesseractStatus('error'); showToast("Failed to load OCR engine.", "error"); }
            document.body.appendChild(script);
        }
    }, [tesseractStatus, showToast]);


    useEffect(() => {
        setIsMounted(true);
        const hashPage = window.location.hash.substring(1);
        if (hashPage && SIDEBAR_ITEMS.some(i => i.path === hashPage)) _setCurrentPage(hashPage);
        else window.location.hash = CONSTANTS.DEFAULT_PAGE;
        const scriptId = 'opencv-script';
        if (!document.getElementById(scriptId)) {
            const script = document.createElement('script');
            script.id = scriptId;
            script.src = 'https://docs.opencv.org/4.9.0/opencv.js';
            script.async = true;
            script.onload = () => {
                const checkCv = () => {
                    if ((window as any).cv?.imread) {
                        console.log('OpenCV loaded successfully.');
                        setCvStatus('loaded');
                    } else {
                        setTimeout(checkCv, 100);
                    }
                };
                checkCv();
            };
            script.onerror = () => { console.error('OpenCV failed to load.'); setCvStatus('error'); };
            document.body.appendChild(script);
        } else {
            if ((window as any).cv) setCvStatus('loaded');
        }
    }, []);
    
    useEffect(() => {
        const linkId = 'google-font-stylesheet';
        if (!document.getElementById(linkId)) {
            const link = document.createElement('link');
            link.id = linkId;
            link.href = CONSTANTS.FONT_URL;
            link.rel = 'stylesheet';
            document.head.appendChild(link);
        }
    }, []);

    useEffect(() => { if (isMounted) { document.documentElement.className = theme; } }, [theme, isMounted]);

    const setCurrentPage = useCallback((page: string) => { _setCurrentPage(page); window.location.hash = page; }, []);

    useEffect(() => {
        const handleHashChange = () => {
            const newPage = window.location.hash.substring(1) || CONSTANTS.DEFAULT_PAGE;
            if (SIDEBAR_ITEMS.some(i => i.path === newPage)) _setCurrentPage(newPage);
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    const toggleTheme = useCallback(() => setTheme(prev => (prev === 'light' ? 'dark' : 'light')), [setTheme]);

    const dismissToast = useCallback((id: number) => setToasts(prev => prev.filter(t => t.id !== id)), []);

    if (!isMounted) return null;

    const appContextValue: AppContextType = {
        theme, toggleTheme, showToast, currentPage, setCurrentPage,
        isMobileMenuOpen, setIsMobileMenuOpen, showShareModal, setShowShareModal,
        croppedImages, setCroppedImages, cvStatus, pdfLibStatus, loadPdfLib,
        tesseractStatus, loadTesseract
    };

    return (
        <AppContext.Provider value={appContextValue}>
            <GlobalStyles />
            <div className={`flex h-screen antialiased selection:bg-[var(--theme-accent-primary)] selection:text-[var(--theme-accent-primary-text)]`} style={{ fontFamily: 'var(--theme-font-family)' }}>
                <Sidebar />
                <div className="flex flex-col flex-1 min-w-0">
                    <Header />
                    <main className="flex-1 overflow-y-auto main-content-bg relative">
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
            </div>
        </AppContext.Provider>
    );
};

interface ToastProps extends ToastItem { onDismiss: (id: number) => void; }
const Toast: FC<ToastProps> = ({ id, message, type, onDismiss }) => {
    useEffect(() => { const timer = setTimeout(() => onDismiss(id), 4000); return () => clearTimeout(timer); }, [id, onDismiss]);
    const iconMap = { success: <CheckCircle size={20} />, error: <AlertTriangle size={20} />, info: <Info size={20} /> };
    const bgColorVar = type === 'success' ? 'var(--theme-toast-success-bg)' : type === 'error' ? 'var(--theme-toast-error-bg)' : 'var(--theme-toast-info-bg)';
    return (
        <motion.div layout initial={{ opacity: 0, y: -20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: 30, scale: 0.95 }} transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            style={{ backgroundColor: bgColorVar, color: 'var(--theme-toast-text-color)' }} className="flex items-center py-3 px-4 rounded-lg shadow-[var(--theme-shadow-lg)] min-w-[280px]">
            <div className="mr-3 flex-shrink-0">{iconMap[type]}</div>
            <span className="flex-grow text-sm font-medium">{message}</span>
            <button aria-label="Dismiss" onClick={() => onDismiss(id)} className="ml-2.5 p-1 rounded-full hover:bg-black/15"> <X size={16} /> </button>
        </motion.div>
    );
};
const ToastContainer: FC<{ toasts: Array<ToastItem>; onDismiss: (id: number) => void }> = ({ toasts, onDismiss }) => (
    <div className="fixed top-5 right-5 z-[2500] space-y-2.5">
        <AnimatePresence initial={false}> {toasts.map((toast) => <Toast key={toast.id} {...toast} onDismiss={onDismiss} />)} </AnimatePresence>
    </div>
);

const Sidebar: FC = () => {
    const { theme, toggleTheme, currentPage, setCurrentPage, isMobileMenuOpen, setIsMobileMenuOpen } = useAppContext();
    const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' ? window.innerWidth >= 768 : true);
    const handleLinkClick = (path: string) => { setCurrentPage(path); if (!isDesktop) setIsMobileMenuOpen(false); };
    useEffect(() => {
        const checkDesktop = () => setIsDesktop(window.innerWidth >= 768);
        window.addEventListener('resize', checkDesktop);
        return () => window.removeEventListener('resize', checkDesktop);
    }, []);
    const sidebarAnimationState = isDesktop ? "open" : (isMobileMenuOpen ? "open" : "closed");
    return (
        <>
            <button aria-label="Open Menu" onClick={() => setIsMobileMenuOpen(true)} className="md:hidden fixed top-[16px] left-4 z-[900] p-2.5 rounded-lg bg-[var(--theme-bg-primary)] text-[var(--theme-text-secondary)] shadow-[var(--theme-shadow-md)] hover:bg-[var(--theme-bg-tertiary)]">
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
                className={`fixed top-0 left-0 h-full w-[var(--theme-sidebar-width)] bg-[var(--theme-bg-primary)] text-[var(--theme-text-primary)] border-r border-[var(--theme-border-primary)] flex flex-col z-[960] md:sticky md:translate-x-0 md:shadow-none shadow-xl`}>
                <div className="h-[var(--theme-header-height)] px-4 border-b border-[var(--theme-border-primary)] flex items-center justify-between shrink-0">
                    <a href="#" onClick={() => handleLinkClick(CONSTANTS.DEFAULT_PAGE)} className="flex items-center space-x-2.5 group">
                        <svg className="w-9 h-9" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="8" fill={theme === 'dark' ? '#60A5FA' : '#3B82F6'}></rect><path d="M14 14H34V18H14V14Z" fill="white"></path><path d="M14 22H34V26H14V22Z" fill="white"></path><path d="M14 30H26V34H14V30Z" fill="white"></path></svg>
                        <h1 className="text-lg font-semibold tracking-tight">{CONSTANTS.APP_NAME}</h1>
                    </a>
                    <button aria-label="Close Menu" onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-2 rounded-md hover:bg-[var(--theme-bg-tertiary)] text-[var(--theme-text-secondary)]"> <X size={22} /> </button>
                </div>
                <nav className="flex-grow p-3.5 space-y-1.5 overflow-y-auto">
                    {SIDEBAR_ITEMS.map((item) => (
                        <a key={item.name} href={`#${item.path}`} onClick={(e) => { e.preventDefault(); handleLinkClick(item.path); }}
                            className={`relative group flex items-center px-3.5 py-2.5 pl-4 rounded-lg text-sm font-medium ${currentPage === item.path ? "bg-[var(--theme-accent-primary)] text-[var(--theme-accent-primary-text)] shadow-[var(--theme-shadow-md)]" : "text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-tertiary)] hover:text-[var(--theme-text-primary)]"}`}>
                            {currentPage === item.path && (<motion.div layoutId="activeIndicator" className="absolute left-[-12px] top-0 bottom-0 w-1.5 bg-[var(--theme-accent-primary)] rounded-r-lg" />)}
                            <div className="flex items-center space-x-3 z-10">
                                <item.icon size={18} className={currentPage === item.path ? "text-[var(--theme-accent-primary-text)]" : "text-[var(--theme-text-tertiary)] group-hover:text-[var(--theme-text-secondary)]"} />
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
    const { setShowShareModal } = useAppContext();
    return (
        <header className="bg-[var(--theme-bg-primary)] text-[var(--theme-text-primary)] border-b border-[var(--theme-border-primary)] sticky top-0 z-[800] h-[var(--theme-header-height)] flex items-center shrink-0">
            <div className="px-4 sm:px-6 w-full flex items-center justify-end">
                <div className="flex items-center space-x-1.5 sm:space-x-2">
                    <button aria-label="Share" onClick={() => setShowShareModal(true)} className="p-2.5 rounded-full text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-tertiary)]"> <Share2 size={20} /> </button>
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
                            <button aria-label="Close Modal" onClick={onClose} className="p-1.5 rounded-full hover:bg-[var(--theme-bg-tertiary)]"> <X size={20} /> </button>
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
                <button aria-label="Copy Link" onClick={copyToClipboard} className="p-2.5 rounded-md bg-[var(--theme-accent-primary)] text-[var(--theme-accent-primary-text)] hover:opacity-90"> <Copy size={18} /> </button>
            </div>
        </Modal>
    );
};

export default App;