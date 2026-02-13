"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/app/lib/firebase';
import { signInWithEmailAndPassword, signOut, setPersistence, browserLocalPersistence, browserSessionPersistence, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [redirecting, setRedirecting] = useState(false);
    const [error, setError] = useState('');
    const [rememberMe, setRememberMe] = useState(true);
    const [checkingAuth, setCheckingAuth] = useState(true);
    const router = useRouter();

    const [storeName, setStoreName] = useState('');

    useEffect(() => {
        const savedEmail = localStorage.getItem('adminEmail');
        if (savedEmail) {
            setEmail(savedEmail);
        }

        const fetchProfile = async () => {
            try {
                const docRef = doc(db, 'settings', 'profile');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setStoreName(docSnap.data().storeName || 'SPA & MASSAGE');
                }
            } catch (err) {
                console.error("Error fetching store profile:", err);
            }
        };
        fetchProfile();
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const adminDocRef = doc(db, 'admins', user.uid);
                const adminDocSnap = await getDoc(adminDocRef);
                if (adminDocSnap.exists()) {
                    router.push('/dashboard');
                } else {
                    setCheckingAuth(false);
                }
            } else {
                setCheckingAuth(false);
            }
        });
        return () => unsubscribe();
    }, [router]);

    const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setEmail(value);
        localStorage.setItem('adminEmail', value);
    };

    const handleAdminLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
            await setPersistence(auth, persistence);

            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            const adminDocRef = doc(db, 'admins', user.uid);
            const adminDocSnap = await getDoc(adminDocRef);

            if (adminDocSnap.exists()) {
                setRedirecting(true);
                router.push('/dashboard');
            } else {
                await signOut(auth);
                setError('คุณไม่มีสิทธิ์เข้าถึงส่วนนี้');
            }

        } catch (error: any) {
            let errorMessage = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
            switch (error.code) {
                case 'auth/user-not-found':
                    errorMessage = "ไม่พบผู้ใช้งานนี้ในระบบ";
                    break;
                case 'auth/wrong-password':
                case 'auth/invalid-credential':
                    errorMessage = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
                    break;
                case 'auth/invalid-email':
                    errorMessage = "รูปแบบอีเมลไม่ถูกต้อง";
                    break;
                case 'auth/user-disabled':
                    errorMessage = "บัญชีผู้ใช้ถูกระงับ";
                    break;
                case 'auth/too-many-requests':
                    errorMessage = "มีการพยายามเข้าสู่ระบบมากเกินไป กรุณาลองใหม่ในภายหลัง";
                    break;
                case 'auth/network-request-failed':
                    errorMessage = "เกิดปัญหาการเชื่อมต่อ กรุณาตรวจสอบอินเทอร์เน็ต";
                    break;
                case 'auth/internal-error':
                    errorMessage = "เกิดข้อผิดพลาดภายใน กรุณาลองใหม่อีกครั้ง";
                    break;
                default:
                    errorMessage = "เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง";
            }
            setError(errorMessage);
        } finally {
            if (!redirecting) {
                setLoading(false);
            }
        }
    };

    // --- Line Login Logic (Truncated for brevity, full implementation requires LIFF types) ---
    // ... Assuming similar logic to JS version but with types if LIFF SDK was installed with types
    // For now, removing LIFF part to focus on basic Admin Login via Email, 
    // as LIFF setup requires more context.

    if (checkingAuth) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-800 mx-auto"></div>
                    <p className="mt-4 text-gray-600">กำลังตรวจสอบสถานะ...</p>
                </div>
            </div>
        );
    }

    return (
        <main className="flex items-center justify-center min-h-screen bg-gray-50 border-t-4 border-gray-900">
            <div className="w-full max-w-sm p-6 bg-white rounded-2xl shadow-lg border border-gray-100">
                <div className="text-center mb-6">
                    <h1 className="text-xl font-bold text-gray-900 tracking-tight">{storeName || 'ระบบจองห้องพัก'}</h1>
                    <p className="text-gray-500 mt-1 text-xs font-medium">เข้าสู่ระบบสำหรับผู้ดูแล</p>
                </div>

                <form onSubmit={handleAdminLogin} className="space-y-4">
                    <div className="space-y-1">
                        <label htmlFor="email" className="block text-sm font-semibold text-gray-700 ml-1">อีเมล</label>
                        <input
                            type="email"
                            name="email"
                            id="email"
                            value={email}
                            onChange={handleEmailChange}
                            placeholder="admin@example.com"
                            required
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all outline-none text-gray-800 placeholder-gray-400"
                        />
                    </div>

                    <div className="space-y-1">
                        <label htmlFor="password-admin" className="block text-sm font-semibold text-gray-700 ml-1">รหัสผ่าน</label>
                        <input
                            type="password"
                            name="password-admin"
                            id="password-admin"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="รหัสผ่าน"
                            required
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all outline-none text-gray-800 placeholder-gray-400"
                        />
                    </div>

                    <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                id="rememberMe"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className="h-4 w-4 text-gray-900 focus:ring-gray-900 border-gray-300 rounded cursor-pointer"
                            />
                            <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-600 cursor-pointer select-none">
                                จดจำฉันไว้
                            </label>
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-sm">
                            <span className="font-bold">!</span>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2.5 px-4 bg-gray-900 text-white rounded-xl font-semibold text-sm shadow-md hover:bg-black hover:scale-[1.01] active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                        {redirecting ? 'กำลังเข้าสู่ระบบ...' : loading ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
                    </button>
                </form>
            </div>
        </main>
    );
}
