import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center p-6 bg-[#F6F6F6] text-[#232227]">
      <div className="w-full max-w-md space-y-8 mt-10">

        {/* Top Widget (Like the image header) */}
        <div className="w-full bg-[#232227] rounded-2xl p-6 flex items-center gap-4 text-white shadow-lg">
          <div className="w-16 h-16 bg-[#F6F6F6]/10 rounded-xl flex items-center justify-center">
            <span className="text-3xl">🌿</span>
          </div>
          <div>
            <h1 className="text-xl font-bold">Good morning</h1>
            <p className="text-sm text-gray-400">Welcome to our Hotel</p>
          </div>
        </div>

        {/* Quick Search / Date Style Display (Visual only) */}
        <div className="flex gap-2">
          <div className="flex-1 bg-white p-3 rounded-xl flex items-center justify-between shadow-sm">
            <span className="text-xs font-bold text-gray-500">Check-in</span>
            <span className="text-sm font-semibold">Today</span>
          </div>
          <div className="flex-1 bg-white p-3 rounded-xl flex items-center justify-between shadow-sm">
            <span className="text-xs font-bold text-gray-500">Check-out</span>
            <span className="text-sm font-semibold">Tomorrow</span>
          </div>
        </div>

        {/* Search Bar Style */}
        <div className="flex gap-2">
          <div className="flex-1 bg-white rounded-xl shadow-sm flex items-center px-4">
            <span className="text-gray-400 text-sm">ค้นหาห้องพัก...</span>
          </div>
          <button className="bg-[#FF754B] w-14 h-14 rounded-xl flex items-center justify-center shadow-md text-white">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </button>
        </div>

        {/* Action Cards Grid */}
        <div className="grid grid-cols-2 gap-4">
          <Link
            href="/appointment"
            className="group relative flex flex-col overflow-hidden rounded-2xl bg-[#E5E5E5] shadow-md transition-all hover:shadow-xl"
          >
            <div className="h-32 flex items-center justify-center bg-gray-200 group-hover:bg-[#FF754B]/20 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 text-[#232227]/50 group-hover:text-[#FF754B] transition-colors">
                <path d="M19.006 3.705a.75.75 0 00-.512-1.41L6 6.838V3a.75.75 0 00-.75-.75h-1.5A.75.75 0 003 3v4.93l-1.006.365a.75.75 0 00.512 1.41l16.5-6z" />
                <path fillRule="evenodd" d="M3.019 11.115L18 5.667V9.09l4.006 1.456a.75.75 0 11-.512 1.41l-.494-.18v8.475h.75a.75.75 0 010 1.5H2.25a.75.75 0 010-1.5H3v-9.129l.019-.006zM18 20.25v-9.566l1.5.546v9.02H18zM3.041 12.681l1.459.53v7.04h-1.5v-7.57z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="bg-[#232227] p-4 text-white text-center">
              <span className="text-sm font-bold">จองห้องพัก</span>
            </div>
          </Link>

          <Link
            href="/login"
            className="group relative flex flex-col overflow-hidden rounded-2xl bg-[#E5E5E5] shadow-md transition-all hover:shadow-xl"
          >
            <div className="h-32 flex items-center justify-center bg-gray-200 group-hover:bg-[#232227]/10 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 text-[#232227]/50">
                <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="bg-[#232227] p-4 text-white text-center">
              <span className="text-sm font-bold">ผู้ดูแลระบบ</span>
            </div>
          </Link>
        </div>

        {/* Footer info */}
        <div className="pt-8 text-[10px] text-[#232227]/30 uppercase tracking-widest text-center">
          <p>© 2024 Hotel Booking System</p>
        </div>
      </div>
    </main>
  );
}
