"use client";

import { useState, useRef, useCallback } from 'react';
import Image from 'next/image';

const Icons = {
    Upload: () => (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
    ),
    Trash: () => (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
    ),
    Image: () => (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
    ),
    Compress: () => (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
    )
};

interface ImageInfo {
    originalSize: string;
    compressedSize: string;
    dimensions: string;
    compressionRatio: string;
}

interface ImageUploadBase64Props {
    imageUrl?: string;
    onImageChange: (base64: string) => void;
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    maxSizeKB?: number;
    compact?: boolean;
}

export default function ImageUploadBase64({
    imageUrl,
    onImageChange,
    maxWidth = 800,
    maxHeight = 800,
    quality = 0.7,
    maxSizeKB = 500,
    compact = false
}: ImageUploadBase64Props) {
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState('');
    const [imageError, setImageError] = useState(false);
    const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const getBase64Size = useCallback((base64String: string) => {
        if (!base64String) return 0;
        const base64 = base64String.split(',')[1] || base64String;
        const bytes = (base64.length * 3) / 4;
        const padding = (base64.match(/=+$/)?.[0]?.length || 0);
        return bytes - padding;
    }, []);

    const formatBytes = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    const compressImage = useCallback((file: File): Promise<{
        base64: string;
        originalSize: number;
        compressedSize: number;
        width: number;
        height: number;
        quality: number;
    }> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.createElement('img');
                img.onload = () => {
                    let { width, height } = img;

                    if (width > maxWidth || height > maxHeight) {
                        const ratio = Math.min(maxWidth / width, maxHeight / height);
                        width = Math.round(width * ratio);
                        height = Math.round(height * ratio);
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) { reject(new Error('Cannot get canvas context')); return; }

                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, width, height);
                    ctx.drawImage(img, 0, 0, width, height);

                    let currentQuality = quality;
                    let base64 = canvas.toDataURL('image/jpeg', currentQuality);
                    let size = getBase64Size(base64);
                    const maxBytes = maxSizeKB * 1024;

                    while (size > maxBytes && currentQuality > 0.1) {
                        currentQuality -= 0.1;
                        base64 = canvas.toDataURL('image/jpeg', currentQuality);
                        size = getBase64Size(base64);
                    }

                    resolve({
                        base64,
                        originalSize: file.size,
                        compressedSize: size,
                        width,
                        height,
                        quality: currentQuality
                    });
                };
                img.onerror = () => reject(new Error('ไม่สามารถโหลดรูปภาพได้'));
                if (e.target?.result) img.src = e.target.result as string;
            };
            reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์ได้'));
            reader.readAsDataURL(file);
        });
    }, [maxWidth, maxHeight, quality, maxSizeKB, getBase64Size]);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setError('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            setError('ขนาดไฟล์ต้องไม่เกิน 10MB');
            return;
        }

        setError('');
        setProcessing(true);
        setProgress(10);

        try {
            setProgress(30);
            const result = await compressImage(file);
            setProgress(80);

            setImageInfo({
                originalSize: formatBytes(result.originalSize),
                compressedSize: formatBytes(result.compressedSize),
                dimensions: `${result.width}x${result.height}`,
                compressionRatio: ((1 - result.compressedSize / result.originalSize) * 100).toFixed(0)
            });

            setProgress(100);
            onImageChange(result.base64);
            setImageError(false);

        } catch (err: any) {
            console.error('Image processing error:', err);
            setError('เกิดข้อผิดพลาดในการประมวลผลรูปภาพ: ' + err.message);
        } finally {
            setProcessing(false);
            setProgress(0);
        }
    };

    const handleDelete = () => {
        onImageChange('');
        setImageError(false);
        setImageInfo(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const isBase64 = imageUrl?.startsWith('data:');
    const currentSize = isBase64 ? formatBytes(getBase64Size(imageUrl || '')) : null;

    return (
        <div className="space-y-2">
            {imageUrl && (
                <div className="relative group">
                    <div className={`relative w-full ${compact ? 'h-32' : 'h-48'} bg-gray-50 rounded-lg overflow-hidden border border-gray-200`}>
                        {!imageError ? (
                            <Image
                                src={imageUrl}
                                alt="Service preview"
                                fill
                                className="object-cover"
                                onError={() => setImageError(true)}
                                unoptimized={!!isBase64}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                                <Icons.Image />
                            </div>
                        )}
                        <div className="absolute inset-0 bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-200 flex items-center justify-center">
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-full shadow-lg transform hover:scale-110"
                            >
                                <Icons.Trash />
                            </button>
                        </div>
                    </div>

                    {currentSize && !compact && (
                        <div className="absolute bottom-1 left-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
                            <Icons.Compress />
                            <span>{currentSize}</span>
                        </div>
                    )}
                </div>
            )}

            <div className="space-y-2">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />

                {!imageUrl && (
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={processing}
                        className={`w-full border border-dashed border-gray-300 rounded-lg ${compact ? 'p-4' : 'p-6'} hover:border-gray-400 hover:bg-gray-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        <div className="flex flex-col items-center gap-2 text-gray-500">
                            <Icons.Image />
                            <div className="text-center">
                                <p className={`font-medium text-gray-700 ${compact ? 'text-xs' : 'text-sm'}`}>
                                    {processing ? 'Processing...' : (compact ? 'Upload' : 'Click to Upload')}
                                </p>
                            </div>
                        </div>
                    </button>
                )}

                {imageUrl && (
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={processing}
                        className="w-full py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-xs text-gray-600 disabled:opacity-50"
                    >
                        {processing ? '...' : 'เปลี่ยนรูป'}
                    </button>
                )}

                {processing && (
                    <div className="w-full bg-gray-200 rounded-full h-1 overflow-hidden">
                        <div className="bg-gray-900 h-1 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                    </div>
                )}

                {error && <p className="text-xs text-red-500">{error}</p>}

                {imageInfo && !processing && !compact && (
                    <p className="text-[10px] text-green-600 text-center">
                        {imageInfo.compressedSize} ({imageInfo.compressionRatio}% saved)
                    </p>
                )}
            </div>
        </div>
    );
}
