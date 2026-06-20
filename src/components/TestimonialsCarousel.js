"use client";

import React, { useState, useEffect } from "react";
import { Star } from "lucide-react";

const testimonials = [
  {
    quote: "Thanks! It was a fun party and a lot more energy and engagement than I expected in a virtual format.",
    author: "Jennifer P.",
    role: "Event Participant",
    initials: "JP",
    gradient: "from-purple-500 to-indigo-500",
  },
  {
    quote: "I don't know who else was involved in the planning of the virtual celebration today but y'all did a GREAT JOB. I'm usually a grinch about those types of things (especially this year!) but it was super fun and engaging. Really, really well done. Please share my appreciation with the rest of the team. You guys rock. Cheers,",
    author: "Kerry",
    role: "Event Participant",
    initials: "K",
    gradient: "from-sky-500 to-indigo-500",
  },
  {
    quote: "I was fortunate to secure the services of Mike Glass for a virtual team building session. In a premeeting Mike listen to my needs and carefully crafted a program to fit my objectives. On the day of the event Mike was well organized and prepared for the session. The energy was AMAZING! Everyone was engaged and involved. After the event, everyone talked about the event and asked me to schedule another session. It is not often that you find someone who can motivate and inspire in the virtual setting! I highly recommend Mike Glass.",
    author: "Leah McCord",
    role: "Principal, Pittsburgh Public Schools",
    initials: "LM",
    gradient: "from-amber-500 to-orange-500",
  },
  {
    quote: "I was very impressed, and we have only had positive feedback. A quality product with very little lead time. I wanted to let you know how much I enjoyed the EOC. The MC was awesome. He was upbeat the entire time. The games encouraged everyone to engage with one another. Teleworking from home, I dont see many of my colleagues as often as I like. However, the EOC allowed me to collaborate with staff I had not seen in a while. Again, thanks for a festive event!!!",
    author: "Event Coordinator",
    role: "Verified Organizer",
    initials: "EC",
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    quote: "The event we hosted last night was received VERY well by our team. Huge Success!",
    author: "Corporate Partner",
    role: "Verified Host Partner",
    initials: "CP",
    gradient: "from-rose-500 to-pink-500",
  }
];

export default function TestimonialsCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);

  // Auto-play effect
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prevIndex) => (prevIndex + 1) % testimonials.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-6 text-left w-full lg:sticky lg:top-28">
      <span className="text-xs font-bold uppercase tracking-wider text-brand-purple">
        WHAT TEAMS ARE SAYING
      </span>

      <div className="glassmorphism border border-white/10 rounded-3xl p-8 relative flex flex-col justify-between shadow-2xl min-h-[380px] transition-all duration-300">
        {/* Large quote icon in background */}
        <span className="text-brand-purple/10 text-8xl font-serif leading-none absolute top-4 left-4 select-none">“</span>

        {/* Content Section with quick fade transition key */}
        <div 
          key={activeIndex}
          className="space-y-6 z-10 flex-grow animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <p className="text-zinc-200 font-medium italic text-sm md:text-base leading-relaxed pt-4">
            &ldquo;{testimonials[activeIndex].quote}&rdquo;
          </p>

          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star key={star} className="h-4.5 w-4.5 fill-amber-400 text-amber-400" />
            ))}
          </div>
        </div>

        {/* Testimonial Author Info & Initials Monogram Badge */}
        <div className="mt-8 flex items-center justify-between border-t border-white/5 pt-6 z-10 shrink-0">
          <div className="space-y-1">
            <span className="text-base md:text-lg font-bold text-white block leading-tight">
              {testimonials[activeIndex].author}
            </span>
            <span className="text-xs text-zinc-400 font-medium block">
              {testimonials[activeIndex].role}
            </span>
          </div>

          {/* Initials badge instead of fake faces */}
          <div className={`w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br ${testimonials[activeIndex].gradient} border-2 border-white/10 flex items-center justify-center shadow-lg`}>
            <span className="text-white font-extrabold text-base md:text-lg tracking-wider">
              {testimonials[activeIndex].initials}
            </span>
          </div>
        </div>
      </div>

      {/* Clickable Dot Indicators */}
      <div className="flex items-center justify-center gap-2 pt-2">
        {testimonials.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setActiveIndex(idx)}
            className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
              idx === activeIndex 
                ? "w-6 bg-brand-purple" 
                : "w-2 bg-zinc-700 hover:bg-zinc-600"
            }`}
            aria-label={`Go to testimonial ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
