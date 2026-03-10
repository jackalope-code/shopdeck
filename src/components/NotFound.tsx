import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f7f8] dark:bg-[#101922] font-[Space_Grotesk,system-ui,sans-serif] text-slate-900 dark:text-slate-100 px-6">
      <div className="text-center max-w-md">
        {/* Glowing icon */}
        <div className="relative inline-flex items-center justify-center mb-8">
          <div className="absolute size-36 rounded-full bg-blue-500/10 blur-2xl" />
          <div className="relative size-24 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
            <span className="material-symbols-outlined text-blue-500 text-5xl">search_off</span>
          </div>
        </div>

        {/* 404 */}
        <h1 className="text-8xl font-black tracking-tighter mb-4 bg-linear-to-br from-blue-500 to-blue-700 bg-clip-text text-transparent">
          404
        </h1>

        <h2 className="text-2xl font-bold mb-3">Page Not Found</h2>
        <p className="text-slate-500 mb-10 leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist, was moved, or the URL was mistyped.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold transition-colors shadow-lg shadow-blue-500/20"
          >
            <span className="material-symbols-outlined text-sm">home</span>
            Go to Dashboard
          </Link>
          <Link
            href="/projects"
            className="flex items-center justify-center gap-2 px-6 py-3 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-bold transition-colors"
          >
            <span className="material-symbols-outlined text-sm">folder_open</span>
            View Projects
          </Link>
        </div>

        {/* Quick nav */}
        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">Quick Links</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 justify-center text-sm">
            {[
              { href: '/active-deals', label: 'Active Deals', icon: 'sell' },
              { href: '/keycaps', label: 'Keycaps', icon: 'format_color_text' },
              { href: '/my-electronics', label: 'My Electronics', icon: 'memory' },
              { href: '/ram-tracker', label: 'RAM Tracker', icon: 'storage' },
            ].map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-1.5 text-slate-500 hover:text-blue-500 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">{link.icon}</span>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
