// When is a support ticket due, and how much of its SLA has been used?
//
//   npm run build:node && node examples/sla.mjs

import { Schedule } from "workclock";

const HOUR = 3_600_000;

const support = new Schedule({
  timeZone: "Europe/London",
  rules: [
    { type: "workday", start: "09:00", end: "17:00" },
    { type: "break", start: "12:00", end: "13:00" },
    { type: "holidays", dates: ["2026-12-25", "2026-12-28"] },
  ],
});

const opened = "2026-12-24T16:30:00Z";
const due = support.add(opened, 8 * HOUR);
console.log(`opened ${opened}, due ${due.toISOString()}`);

const now = "2026-12-29T11:00:00Z";
console.log(`used by ${now}: ${support.between(opened, now) / HOUR} h`);

const { end } = support.nextPeriod(now);
console.log(`working until ${end.toISOString()}`);

// Many tickets at once: one call into WebAssembly instead of one per ticket.
const tickets = [opened, "2026-12-24T17:30:00Z", now];
const deadlines = support.addMany(tickets, 8 * HOUR);
tickets.forEach((ticket, i) =>
  console.log(`${ticket} -> ${deadlines[i].toISOString()}`),
);
