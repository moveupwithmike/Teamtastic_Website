"use client";

import React, { useState, useEffect } from "react";
import { Star } from "lucide-react";

const testimonials = [
  {
    type: "text",
    quote: "Thanks! It was a fun party and a lot more energy and engagement than I expected in a virtual format.",
    author: "Jennifer P.",
    role: "Event Participant",
    initials: "JP",
    gradient: "from-purple-500 to-indigo-500",
  },
  {
    type: "text",
    quote: "I don't know who else was involved in the planning of the virtual celebration today but y'all did a GREAT JOB. I'm usually a grinch about those types of things (especially this year!) but it was super fun and engaging. Really, really well done. Please share my appreciation with the rest of the team. You guys rock. Cheers,",
    author: "Kerry",
    role: "Event Participant",
    initials: "K",
    gradient: "from-sky-500 to-indigo-500",
  },
  {
    type: "image",
    src: "/screenshot1.png",
    title: "Interactive Live Buzzer Trivia Battle",
    desc: "Teams compete in real-time speed rounds, buzzing in to score points and dominate the leaderboard."
  },
  {
    type: "text",
    quote: "I was fortunate to secure the services of Mike Glass for a virtual team building session. In a premeeting Mike listen to my needs and carefully crafted a program to fit my objectives. On the day of the event Mike was well organized and prepared for the session. The energy was AMAZING! Everyone was engaged and involved. After the event, everyone talked about the event and asked me to schedule another session. It is not often that you find someone who can motivate and inspire in the virtual setting! I highly recommend Mike Glass.",
    author: "Leah McCord",
    role: "Principal, Pittsburgh Public Schools",
    initials: "LM",
    gradient: "from-amber-500 to-orange-500",
  },
  {
    type: "text",
    quote: "I was very impressed, and we have only had positive feedback. A quality product with very little lead time. I wanted to let you know how much I enjoyed the EOC. The MC was awesome. He was upbeat the entire time. The games encouraged everyone to engage with one another. Teleworking from home, I dont see many of my colleagues as often as I like. However, the EOC allowed me to collaborate with staff I had not seen in a while. Again, thanks for a festive event!!!",
    author: "Event Coordinator",
    role: "Verified Organizer",
    initials: "EC",
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    type: "image",
    src: "/screenshot2.png",
    title: "Michael Hosting a B2B Team Challenge",
    desc: "Our Master Emcee delivering high energy, engaging teams on video calls with jokes, pacing, and excitement."
  },
  {
    type: "text",
    quote: "Thank you so much for your assistance. The event we hosted last night was received VERY well by our team. Huge Success! We may be interested in moving to a subscription plan in the future. Are there any promotions available if we go that route? I am thinking having 4 events a month is a good starting point.",
    author: "Corporate Partner",
    role: "Verified Host Partner",
    initials: "CP",
    gradient: "from-rose-500 to-pink-500",
  },
  {
    type: "text",
    quote: "Was a great and fun event and yes, easier to plan than expected – Horia was great to work with. Michael is a fantastic host!",
    author: "Verified Event Host",
    role: "Corporate Client",
    initials: "EH",
    gradient: "from-fuchsia-500 to-pink-500",
  },
  {
    type: "image",
    src: "/screenshot3.png",
    title: "Dynamic Team Leaderboard & Standings",
    desc: "Live rankings update dynamically as rounds complete, keeping player competition sharp and fun."
  },
  {
    type: "text",
    quote: "Thanks so much for helping ukengames! Our team had a great time, we have received some fantastic feedback. I've just completed the survey from the previous email. Thanks for your help with getting this experience set up for our team.",
    author: "Uken Games Team",
    role: "Verified Client",
    initials: "UG",
    gradient: "from-violet-500 to-fuchsia-500",
  },
  {
    type: "text",
    quote: "Yes, the feedback was awesome! Everyone really enjoyed themselves and they can’t stop talking about how much of a unique experience this has been. We really had a great time and will definitely be calling on you again. We’ve done other trivia games but nothing like this. By the way, Michael was really a great host.",
    author: "Verified Client",
    role: "Corporate Client",
    initials: "VC",
    gradient: "from-cyan-500 to-teal-500",
  },
  {
    type: "image",
    src: "/screenshot4.png",
    title: "Customized Workplace Trivia Rounds",
    desc: "Tailored categories and question blocks custom-made with company logos, values, and insider jokes."
  },
  {
    type: "text",
    quote: "This event was awesome and really appreciate how well Michael was able to improvise and make our last minute event a success. Everyone was very happy.",
    author: "Event Organizer",
    role: "Corporate Client",
    initials: "EO",
    gradient: "from-yellow-500 to-amber-500",
  }
];

export default function TestimonialsCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);

  // Auto-play effect
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prevIndex) => (prevIndex + 1) % testimonials.length);
    }, 8000); // 8 seconds per slide to allow reading longer quotes
    return () => clearInterval(timer);
  }, []);

  const currentSlide = testimonials[activeIndex];

  return (
    <div className="space-y-6 text-left w-full lg:sticky lg:top-28">
      <span className="text-sm md:text-base font-extrabold uppercase tracking-widest text-brand-purple block animate-in fade-in duration-300">
        {currentSlide.type === "image" ? "PAST EVENTS IN ACTION" : "WHAT TEAMS ARE SAYING"}
      </span>

      <div className="glassmorphism border border-white/10 rounded-3xl p-8 relative flex flex-col justify-between shadow-2xl min-h-[440px] transition-all duration-300">
        {/* Large quote icon in background - text only */}
        {currentSlide.type === "text" && (
          <span className="text-brand-purple/10 text-8xl font-serif leading-none absolute top-4 left-4 select-none">“</span>
        )}

        {/* Content Section with quick fade transition key */}
        <div 
          key={activeIndex}
          className="space-y-4 z-10 flex-grow flex flex-col justify-between animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          {currentSlide.type === "image" ? (
            <div className="space-y-4 flex-grow flex flex-col justify-between">
              {/* Image Frame */}
              <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-zinc-950/80 aspect-[16/10] w-full shrink-0">
                <img
                  src={currentSlide.src}
                  alt={currentSlide.title}
                  className="w-full h-full object-cover select-none pointer-events-none hover:scale-102 transition-transform duration-500"
                />
              </div>
              {/* Caption */}
              <div className="space-y-1 mt-2">
                <h4 className="text-base sm:text-lg font-bold text-white leading-snug">
                  {currentSlide.title}
                </h4>
                <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                  {currentSlide.desc}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 flex-grow flex flex-col justify-between">
              <p className="text-zinc-100 font-semibold italic text-base md:text-lg lg:text-xl leading-relaxed pt-4">
                &ldquo;{currentSlide.quote}&rdquo;
              </p>

              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className="h-4.5 w-4.5 fill-amber-400 text-amber-400" />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Testimonial Author Info & Initials Monogram Badge - text only */}
        {currentSlide.type === "text" && (
          <div className="mt-8 flex items-center justify-between border-t border-white/5 pt-6 z-10 shrink-0">
            <div className="space-y-1">
              <span className="text-base md:text-lg font-bold text-white block leading-tight">
                {currentSlide.author}
              </span>
              <span className="text-xs text-zinc-400 font-medium block">
                {currentSlide.role}
              </span>
            </div>

            {/* Initials badge instead of fake faces */}
            <div className={`w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br ${currentSlide.gradient} border-2 border-white/10 flex items-center justify-center shadow-lg shrink-0`}>
              <span className="text-white font-extrabold text-base md:text-lg tracking-wider">
                {currentSlide.initials}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Clickable Dot Indicators */}
      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
        {testimonials.map((item, idx) => (
          <button
            key={idx}
            onClick={() => setActiveIndex(idx)}
            className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
              idx === activeIndex 
                ? "w-6 bg-brand-purple" 
                : "w-2 bg-zinc-700 hover:bg-zinc-650"
            }`}
            aria-label={`Go to slide ${idx + 1}`}
            title={item.type === "image" ? `Screenshot: ${item.title}` : `Review by ${item.author}`}
          />
        ))}
      </div>
    </div>
  );
}
