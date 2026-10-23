//! Interval arithmetic over blocks of working time.

use std::ops::RangeInclusive;

use jiff::civil::{Date, Time};
use jiff::tz::TimeZone;
use jiff::Timestamp;

/// A half-open interval of instants, `[start, end)`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct Block {
    pub(crate) start: Timestamp,
    pub(crate) end: Timestamp,
}

impl Block {
    /// The part of `[start, end)` inside `[lo, hi)`, if any.
    pub(crate) fn clipped(
        start: Timestamp,
        end: Timestamp,
        lo: Timestamp,
        hi: Timestamp,
    ) -> Option<Self> {
        let block = Block {
            start: start.max(lo),
            end: end.min(hi),
        };
        (block.start < block.end).then_some(block)
    }
}

/// Converts a wall-clock time to an instant with the compatible strategy:
/// times in a gap move forward by the gap's length, and repeated times take
/// the earlier occurrence.
///
/// Times beyond either end of jiff's range saturate to that end, so a block
/// that runs past the range keeps the part inside it.
pub(crate) fn resolve(date: Date, time: Time, tz: &TimeZone) -> Timestamp {
    let beyond = if date.year() < 0 {
        Timestamp::MIN
    } else {
        Timestamp::MAX
    };
    tz.to_ambiguous_zoned(date.to_datetime(time))
        .compatible()
        .map_or(beyond, |zoned| zoned.timestamp())
}

/// Local dates whose blocks can overlap `[lo, hi)`.
///
/// A block that starts on a date ends before 00:00 two dates later, and DST
/// resolution can move either end by a few hours, so one extra date on each
/// side is enough.
pub(crate) fn local_dates(lo: Timestamp, hi: Timestamp, tz: &TimeZone) -> RangeInclusive<Date> {
    let first = tz.to_datetime(lo).date();
    let first = first.yesterday().and_then(Date::yesterday).unwrap_or(first);
    let last = tz.to_datetime(hi).date();
    let last = last.tomorrow().unwrap_or(last);
    first..=last
}

/// Every date in `dates`, in order.
pub(crate) fn each_date(dates: RangeInclusive<Date>) -> impl Iterator<Item = Date> {
    let last = *dates.end();
    std::iter::successors(Some(*dates.start()), |d| d.tomorrow().ok())
        .take_while(move |d| *d <= last)
}

/// Sorts `blocks` and merges the ones that overlap or touch.
pub(crate) fn union(blocks: &mut Vec<Block>) {
    blocks.sort_unstable_by_key(|b| b.start);
    let mut merged: Vec<Block> = Vec::with_capacity(blocks.len());
    for &block in blocks.iter() {
        match merged.last_mut() {
            Some(last) if block.start <= last.end => last.end = last.end.max(block.end),
            _ => merged.push(block),
        }
    }
    *blocks = merged;
}

/// Removes `off` from `on`. Both must be sorted and merged, as [`union`]
/// leaves them.
pub(crate) fn subtract(on: &[Block], off: &[Block]) -> Vec<Block> {
    let mut out = Vec::with_capacity(on.len());
    let mut off = off.iter().peekable();
    for &block in on {
        let mut start = block.start;
        while let Some(gap) = off.peek() {
            if gap.end <= start {
                off.next();
                continue;
            }
            if gap.start >= block.end {
                break;
            }
            if gap.start > start {
                out.push(Block {
                    start,
                    end: gap.start,
                });
            }
            start = gap.end;
            if start >= block.end {
                break;
            }
            off.next();
        }
        if start < block.end {
            out.push(Block {
                start,
                end: block.end,
            });
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use jiff::Timestamp;
    use proptest::prelude::*;

    use super::{subtract, union, Block};

    fn block(start: i64, end: i64) -> Block {
        Block {
            start: Timestamp::from_second(start).unwrap(),
            end: Timestamp::from_second(end).unwrap(),
        }
    }

    fn blocks(pairs: &[(i64, i64)]) -> Vec<Block> {
        pairs.iter().map(|&(s, e)| block(s, e)).collect()
    }

    fn contains(blocks: &[Block], second: i64) -> bool {
        let t = Timestamp::from_second(second).unwrap();
        blocks.iter().any(|b| b.start <= t && t < b.end)
    }

    #[test]
    fn union_merges_overlapping_touching_and_nested_blocks() {
        let mut got = blocks(&[(50, 60), (0, 10), (10, 20), (15, 18), (30, 40), (35, 45)]);
        union(&mut got);
        assert_eq!(got, blocks(&[(0, 20), (30, 45), (50, 60)]));
    }

    #[test]
    fn subtract_cuts_holes_and_edges() {
        let on = blocks(&[(0, 100), (200, 300)]);
        let off = blocks(&[(-10, 5), (20, 30), (40, 50), (90, 210), (250, 400)]);
        assert_eq!(
            subtract(&on, &off),
            blocks(&[(5, 20), (30, 40), (50, 90), (210, 250)])
        );
    }

    #[test]
    fn subtract_keeps_blocks_without_time_off() {
        let on = blocks(&[(0, 10), (20, 30)]);
        assert_eq!(subtract(&on, &[]), on);
        assert_eq!(subtract(&on, &blocks(&[(10, 20)])), on);
    }

    fn arb_blocks() -> impl Strategy<Value = Vec<Block>> {
        prop::collection::vec((0i64..60, 1i64..20), 0..8).prop_map(|pairs| {
            pairs
                .into_iter()
                .map(|(s, len)| block(s, s + len))
                .collect()
        })
    }

    proptest! {
        #[test]
        fn combination_matches_pointwise_definition(on in arb_blocks(), off in arb_blocks()) {
            let (mut merged_on, mut merged_off) = (on.clone(), off.clone());
            union(&mut merged_on);
            union(&mut merged_off);
            let working = subtract(&merged_on, &merged_off);
            for second in -1..90 {
                prop_assert_eq!(
                    contains(&working, second),
                    contains(&on, second) && !contains(&off, second),
                    "at second {}", second
                );
            }
            prop_assert!(working.windows(2).all(|w| w[0].end < w[1].start));
        }
    }
}
