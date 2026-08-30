// Targeted boundary corpus for the BOOKING_REQUEST vs NOT_NOW remediation
// (TEAMTASTIC_INBOUND_CLASSIFIER_CERTIFICATION.md, "Remediation and Re-Certification").
// Deliberately adversarial: every message contains a bare future-time phrase
// ("next week/month/quarter/year", a month name, "after the holidays", "later this
// year", "sometime this fall") so that distinguishing booking from deferral requires
// the surrounding intent, not just the presence of the phrase. Kept separate from the
// original 129-message corpus per instruction — the frozen corpus's own results are
// never edited to make the candidate look better.

import type { CorpusCase } from "./corpus.ts";

export const BOUNDARY_CORPUS: CorpusCase[] = [
  // ---- booking_request: asking about availability, not deferring (8)
  { id: "bnd-book-01", category: "boundary-booking", subject: "Re: dates", body: "What dates are available next month?", primary: "booking_request" },
  { id: "bnd-book-02", category: "boundary-booking", subject: "Re: Q on availability", body: "Do you have anything open next quarter?", primary: "booking_request" },
  { id: "bnd-book-03", category: "boundary-booking", subject: "Re: planning", body: "Can we book something in January?", primary: "booking_request" },
  { id: "bnd-book-04", category: "boundary-booking", subject: "Re: availability", body: "What availability do you have later this year?", primary: "booking_request" },
  { id: "bnd-book-05", category: "boundary-booking", subject: "Re: this week", body: "Are you free next week?", primary: "booking_request" },
  { id: "bnd-book-06", category: "boundary-booking", subject: "Re: fall", body: "Is there anything open sometime this fall?", primary: "booking_request" },
  { id: "bnd-book-07", category: "boundary-booking", subject: "Re: call", body: "Can we schedule a call sometime next month?", primary: "booking_request" },
  { id: "bnd-book-08", category: "boundary-booking", subject: "Re: January", body: "Do you have any openings in January?", primary: "booking_request", notes: "Harder phrasing (\"openings\" not \"open\") — included to honestly test regex recall limits, not to guarantee a pass." },

  // ---- not_now: explicitly deferring engagement, not asking about dates (8)
  { id: "bnd-now-01", category: "boundary-not_now", subject: "Re: timing", body: "Check back next month.", primary: "not_now" },
  { id: "bnd-now-02", category: "boundary-not_now", subject: "Re: timing", body: "Reach out next quarter.", primary: "not_now" },
  { id: "bnd-now-03", category: "boundary-not_now", subject: "Re: timing", body: "Maybe next year.", primary: "not_now" },
  { id: "bnd-now-04", category: "boundary-not_now", subject: "Re: 2027", body: "We're not planning anything until January.", primary: "not_now" },
  { id: "bnd-now-05", category: "boundary-not_now", subject: "Re: holidays", body: "Try me again after the holidays.", primary: "not_now" },
  { id: "bnd-now-06", category: "boundary-not_now", subject: "Re: later", body: "Let's revisit later this year.", primary: "not_now" },
  { id: "bnd-now-07", category: "boundary-not_now", subject: "Re: fall", body: "Circle back sometime this fall.", primary: "not_now" },
  { id: "bnd-now-08", category: "boundary-not_now", subject: "Re: timing", body: "Not the right time — check back next week.", primary: "not_now" },

  // ---- question: a logistics question that happens to reference a future period (6)
  { id: "bnd-q-01", category: "boundary-question", subject: "Re: format", body: "How long does a typical event run in January?", primary: "question" },
  { id: "bnd-q-02", category: "boundary-question", subject: "Re: policy", body: "What happens if we need to reschedule next month?", primary: "question" },
  { id: "bnd-q-03", category: "boundary-question", subject: "Re: pricing policy", body: "Does pricing change depending on the time of year, like next quarter?", primary: "question", secondary: "pricing_request" },
  { id: "bnd-q-04", category: "boundary-question", subject: "Re: lead time", body: "How far in advance do we need to book for next year?", primary: "question", secondary: "booking_request" },
  { id: "bnd-q-05", category: "boundary-question", subject: "Re: fall package", body: "What's included if we go with the fall package?", primary: "question" },
  { id: "bnd-q-06", category: "boundary-question", subject: "Re: formats", body: "Is there a different format for events later this year?", primary: "question" },

  // ---- interested: genuine enthusiasm, timing is incidental (5)
  { id: "bnd-int-01", category: "boundary-interested", subject: "Re: idea", body: "This sounds great, we'd love to do something next month.", primary: "interested" },
  { id: "bnd-int-02", category: "boundary-interested", subject: "Re: yes", body: "Really interested — let's make this happen next quarter.", primary: "interested" },
  { id: "bnd-int-03", category: "boundary-interested", subject: "Re: excited", body: "Sounds perfect, we're excited for something later this year.", primary: "interested" },
  { id: "bnd-int-04", category: "boundary-interested", subject: "Re: fall event", body: "Yes, let's do this sometime this fall, sounds fun.", primary: "interested" },
  { id: "bnd-int-05", category: "boundary-interested", subject: "Re: on board", body: "We're on board, keen to get something on the books for next year.", primary: "interested", secondary: "booking_request" },

  // ---- ambiguous: hedged, non-committal despite a temporal phrase (5)
  { id: "bnd-amb-01", category: "boundary-ambiguous", subject: "Re: hi", body: "Next month, maybe.", primary: "unknown" },
  { id: "bnd-amb-02", category: "boundary-ambiguous", subject: "Re: hi", body: "We'll see about next quarter.", primary: "unknown" },
  { id: "bnd-amb-03", category: "boundary-ambiguous", subject: "Re: hi", body: "Later this year, we'll think about it.", primary: "unknown" },
  { id: "bnd-amb-04", category: "boundary-ambiguous", subject: "Re: hi", body: "Next year, who knows.", primary: "unknown" },
  { id: "bnd-amb-05", category: "boundary-ambiguous", subject: "Re: hi", body: "Sometime this fall, we'll see.", primary: "unknown" },
];

// Unsubscribe re-verification corpus (Section 4): required phrases plus benign
// look-alikes that must NOT trigger unsubscribe. `mustUnsubscribe: false` marks the
// benign cases explicitly, since CorpusCase's `primary` field alone can't distinguish
// "this is a different real label" from "this must specifically NOT be unsubscribe."
export type UnsubscribeCase = { id: string; body: string; mustUnsubscribe: boolean; expectedIfNot?: string };

export const UNSUBSCRIBE_GUARD_CORPUS: UnsubscribeCase[] = [
  { id: "uns-req-01", body: "Unsubscribe.", mustUnsubscribe: true },
  { id: "uns-req-02", body: "Remove me.", mustUnsubscribe: true },
  { id: "uns-req-03", body: "Remove me from your list.", mustUnsubscribe: true },
  { id: "uns-req-04", body: "Take me off your list.", mustUnsubscribe: true },
  { id: "uns-req-05", body: "Stop emailing me.", mustUnsubscribe: true },
  { id: "uns-req-06", body: "Please stop.", mustUnsubscribe: true },
  { id: "uns-req-07", body: "Don't contact me again.", mustUnsubscribe: true },
  { id: "uns-req-08", body: "Do not contact me.", mustUnsubscribe: true },
  { id: "uns-req-09", body: "Take me off these emails.", mustUnsubscribe: true },
  { id: "uns-benign-01", body: "Please stop by our office.", mustUnsubscribe: false, expectedIfNot: "referral-or-other, never unsubscribe" },
  { id: "uns-benign-02", body: "Don't contact Jane; contact me instead.", mustUnsubscribe: false, expectedIfNot: "referral-or-other, never unsubscribe" },
  { id: "uns-benign-03", body: "Can you stop the timer during the game?", mustUnsubscribe: false, expectedIfNot: "question-or-other, never unsubscribe" },
];
