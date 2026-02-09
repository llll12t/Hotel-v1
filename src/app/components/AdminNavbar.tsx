"use client";

import { useState, useRef, useEffect } from "react";
import { useToast } from "@/app/components/Toast";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { auth } from "@/app/lib/firebase";
import { signOut } from "firebase/auth";
import { format } from "date-fns";
import { th } from "date-fns/locale";

// --- Icons ---
const Icons = {
    Menu: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" /></svg>,
    Close: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>,
    ChevronDown: ({ className }: { className?: string }) => <svg className={`w-4 h-4 ${className || ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>,
    Bell: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
    Logout: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
    Check: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>,
    Trash: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
};

// --- Hook ---
function useClickOutside(ref: React.RefObject<any>, handler: (e: MouseEvent) => void) {
    useEffect(() => {
        const listener = (e: MouseEvent) => {
            if (!ref.current || ref.current.contains(e.target as Node)) return;
            handler(e);
        };
        document.addEventListener("mousedown", listener);
        return () => document.removeEventListener("mousedown", listener);
    }, [ref, handler]);
}

interface NavItem {
    name: string;
    href: string;
}

interface NavLinkConfig {
    name: string;
    href?: string;
    items?: NavItem[];
}

// --- Nav Links ---
const navLinks: NavLinkConfig[] = [
    { name: "แดชบอร์ด", href: "/dashboard" },
    { name: "ปฏิทิน", href: "/calendar" },
    {
        name: "ข้อมูลหลัก",
        items: [
            { name: "จองห้องพัก", href: "/create-booking" },
            { name: "ประเภทห้องพัก", href: "/room-types" },
            { name: "ห้องพัก", href: "/rooms" },
            { name: "แขก", href: "/customers" },
        ]
    },
    {
        name: "วิเคราะห์",
        items: [
            { name: "ของรางวัล", href: "/manage-rewards" },
            { name: "วิเคราะห์", href: "/analytics" },
            { name: "รีวิวห้องพัก", href: "/reviews" },
        ]
    },
    {
        name: "ตั้งค่า",
        items: [
            { name: "จัดการบุคลากร", href: "/employees" },
            { name: "ตั้งค่าระบบ", href: "/settings" },
        ]
    },
];

interface NavLinkProps {
    link: NavLinkConfig;
    currentPath: string;
    onClick?: () => void;
}

// --- NavLink Component ---
const NavLink: React.FC<NavLinkProps> = ({ link, currentPath, onClick }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    useClickOutside(dropdownRef, () => setIsOpen(false));

    const isActive = link.items ? link.items.some(i => currentPath.startsWith(i.href)) : (link.href && currentPath === link.href);

    if (link.items) {
        return (
            <div className="relative" ref={dropdownRef}>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`px-3 py-2 text-sm font-medium flex items-center gap-1 rounded-md transition-colors ${isActive ? 'text-gray-900 bg-gray-100' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}
                >
                    {link.name}
                    <Icons.ChevronDown className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                    <div className="absolute left-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                        {link.items.map(item => (
                            <Link
                                key={item.name}
                                href={item.href}
                                onClick={() => { setIsOpen(false); onClick?.(); }}
                                className={`block px-4 py-2 text-sm ${currentPath === item.href ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                            >
                                {item.name}
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    if (!link.href) return null;

    return (
        <Link
            href={link.href}
            onClick={onClick}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${isActive ? 'text-white bg-gray-900' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}
        >
            {link.name}
        </Link>
    );
};

interface AdminNavbarProps {
    notifications?: any[];
    unreadCount?: number;
    onMarkAsRead?: () => void;
    onClearAll?: () => void;
}

// --- Main Navbar ---
export default function AdminNavbar({ notifications = [], unreadCount = 0, onMarkAsRead, onClearAll }: AdminNavbarProps) {
    const pathname = usePathname() || '';
    const router = useRouter();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const notifRef = useRef<HTMLDivElement>(null);

    useClickOutside(notifRef, () => setIsNotifOpen(false));

    const handleLogout = async () => {
        try { await signOut(auth); router.push("/"); }
        catch (e) { console.error("Error signing out:", e); }
    };

    const toggleNotif = () => {
        const newOpen = !isNotifOpen;
        setIsNotifOpen(newOpen);
        // Mark as read immediately when opening, or use a button? Platform choice.
        // Let's use the explicit button inside to be safe, or prop onMarkAsRead
        if (newOpen && onMarkAsRead) {
            // onMarkAsRead(); // Optional: uncomment if you want auto-read on open
        }
    };

    const hasUnread = unreadCount > 0;

    return (
        <nav className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
            <div className="max-w-7xl mx-auto px-4">
                <div className="flex justify-between h-14 items-center">

                    {/* Left: Logo */}
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-md">
                            {isMobileMenuOpen ? <Icons.Close /> : <Icons.Menu />}
                        </button>
                        <Link href="/dashboard" className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <span className="w-8 h-8 rounded-lg bg-gray-900 text-white flex items-center justify-center font-bold">A</span>
                            Admin Panel
                        </Link>
                    </div>

                    {/* Center: Desktop Nav */}
                    <div className="hidden md:flex items-center gap-1">
                        {navLinks.map(link => <NavLink key={link.name} link={link} currentPath={pathname} />)}
                    </div>

                    {/* Right: Notifications & Logout */}
                    <div className="flex items-center gap-2">
                        {/* Notification */}
                        <div className="relative" ref={notifRef}>
                            <button onClick={toggleNotif} className={`p-2 rounded-md transition-colors relative ${hasUnread ? 'text-red-600 bg-red-50 hover:bg-red-100' : 'text-gray-600 hover:bg-gray-100'}`}>
                                <Icons.Bell />
                                {hasUnread && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>}
                            </button>

                            {isNotifOpen && (
                                <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                                        <span className="text-sm font-semibold text-gray-900">การแจ้งเตือน ({unreadCount})</span>
                                        <div className="flex gap-1">
                                            {hasUnread && <button onClick={onMarkAsRead} className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded" title="อ่านทั้งหมด"><Icons.Check /></button>}
                                            {notifications.length > 0 && <button onClick={onClearAll} className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded" title="ลบทั้งหมด"><Icons.Trash /></button>}
                                        </div>
                                    </div>
                                    <div className="max-h-80 overflow-y-auto">
                                        {notifications.length === 0 ? (
                                            <div className="py-8 text-center text-gray-400 text-sm">ไม่มีการแจ้งเตือน</div>
                                        ) : (
                                            <div className="divide-y divide-gray-100">
                                                {notifications.map(n => (
                                                    <div key={n.id} className={`px-4 py-3 hover:bg-gray-50 flex gap-3 ${!n.isRead ? 'bg-blue-50/50' : ''}`}>
                                                        <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${n.type === 'error' ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-gray-900">{n.title}</p>
                                                            <p className="text-sm text-gray-600 line-clamp-2">{n.message}</p>
                                                            <p className="text-xs text-gray-400 mt-1">
                                                                {n.createdAt && n.createdAt.toDate ? format(n.createdAt.toDate(), 'dd MMM HH:mm', { locale: th }) : 'เพิ่งมาถึง'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Logout */}
                        <button onClick={handleLogout} className="hidden md:flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                            <Icons.Logout />
                            <span>ออก</span>
                        </button>
                    </div>
                </div>

                {/* Mobile Menu */}
                {isMobileMenuOpen && (
                    <div className="md:hidden border-t border-gray-100 py-3">
                        {navLinks.map(link => (
                            <div key={link.name}>
                                {link.items ? (
                                    <div className="py-2">
                                        <div className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase">{link.name}</div>
                                        {link.items.map(item => (
                                            <Link
                                                key={item.name}
                                                href={item.href}
                                                onClick={() => setIsMobileMenuOpen(false)}
                                                className={`block px-4 py-2 text-sm ${pathname === item.href ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                                            >
                                                {item.name}
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    link.href ? (
                                        <Link
                                            href={link.href}
                                            onClick={() => setIsMobileMenuOpen(false)}
                                            className={`block px-4 py-2 text-sm ${pathname === link.href ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                                        >
                                            {link.name}
                                        </Link>
                                    ) : null
                                )}
                            </div>
                        ))}
                        <div className="border-t border-gray-100 mt-2 pt-2">
                            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-red-600 bg-red-50 rounded-md hover:bg-red-100">
                                <Icons.Logout /> ออกจากระบบ
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </nav>
    );
}
