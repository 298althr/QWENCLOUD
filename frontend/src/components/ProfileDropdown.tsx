"use client";

import { useState, useEffect, useRef } from "react";
import { User, X, ExternalLink, Mail, MapPin, Briefcase, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { USER_PROFILE } from "@/config/profile";

export default function ProfileDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const initials = USER_PROFILE.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-md transition-colors",
          open ? "bg-ink-800 text-ink-100" : "text-ink-400 hover:bg-ink-800 hover:text-ink-100"
        )}
      >
        {USER_PROFILE.avatar ? (
          <img src={USER_PROFILE.avatar} alt={USER_PROFILE.name} className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gold-500/20 text-xs font-semibold text-gold-500">
            {initials || <User className="h-4 w-4" />}
          </div>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-lg border border-ink-700 bg-ink-900 shadow-xl">
          <div className="relative overflow-hidden px-4 pb-4 pt-5">
            <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-r from-gold-500/10 to-ink-800/50" />
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 text-ink-500 hover:text-ink-200"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="relative flex items-center gap-3">
              {USER_PROFILE.avatar ? (
                <img src={USER_PROFILE.avatar} alt={USER_PROFILE.name} className="h-14 w-14 rounded-full border-2 border-ink-700 object-cover" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-ink-700 bg-gold-500/20 text-lg font-semibold text-gold-500">
                  {initials || <User className="h-6 w-6" />}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-base font-semibold text-ink-100">{USER_PROFILE.name}</h3>
                <p className="text-xs text-gold-500">{USER_PROFILE.role}</p>
              </div>
            </div>

            <p className="relative mt-3 text-xs leading-relaxed text-ink-400">{USER_PROFILE.bio}</p>

            <div className="relative mt-3 space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-ink-500">
                <Mail className="h-3.5 w-3.5 text-ink-600" />
                <span>{USER_PROFILE.email}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-ink-500">
                <MapPin className="h-3.5 w-3.5 text-ink-600" />
                <span>{USER_PROFILE.location}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-ink-700 px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
              <FileText className="h-3.5 w-3.5" />
              <span>Resume / Portfolio</span>
            </div>
            <div className="mt-2 rounded-lg border border-ink-800 bg-ink-950/50 p-3">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-gold-500" />
                <span className="text-sm font-medium text-ink-200">{USER_PROFILE.resume.headline}</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-ink-500 line-clamp-4">
                {USER_PROFILE.resume.summary}
              </p>
              <ul className="mt-2 space-y-1">
                {USER_PROFILE.resume.highlights.slice(0, 3).map((h, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-ink-400">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-gold-500" />
                    <span className="line-clamp-2">{h}</span>
                  </li>
                ))}
              </ul>
            </div>
            <a
              href={USER_PROFILE.portfolioUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-gold-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-gold-600"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Visit Portfolio
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
